import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { Role, Session, User } from "@travelghana/database";
import type { AuthResponse, SessionUser } from "@travelghana/types";

import { ApiError } from "../../common/errors/api-error";
import { primaryWebAppUrl } from "../../common/config/app-urls";
import { toSessionUser } from "../../common/mappers/session-user.mapper";
import { PrismaService } from "../../common/prisma.service";
import type { AuthenticatedRequest } from "../../common/guards/session.guard";

import { MAILER, Mailer } from "../mail/mailer";
import { resetEmail, verificationEmail } from "../mail/email-templates";
import { generateCode, generateToken, hashPassword, hashToken, verifyPassword } from "./passwords";

export const SESSION_COOKIE = "tg_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour for email tokens
const BCRYPT_UNKNOWN_DELAY = 120; // ms — constant-ish work for unknown emails

/** Response shape after a successful login/register: user + raw session token. */
export interface AuthResult extends AuthResponse {
  sessionToken: string;
  sessionExpiresAt: Date;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  /** Ensure exactly one ADMIN bootstrap user exists (secrets from env, §40). */
  async onModuleInit(): Promise<void> {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      return;
    }
    const existing = await this.prisma.user.findUnique({ where: { email }, include: { memberships: true } });
    if (existing) {
      if (!existing.memberships.some((m) => m.role === "ADMIN")) {
        await this.prisma.roleMembership.create({
          data: { userId: existing.id, role: "ADMIN" },
        });
      }
      return;
    }
    await this.prisma.user.create({
      data: {
        email,
        name: "TravelGhana Admin",
        passwordHash: await hashPassword(password),
        emailVerifiedAt: new Date(),
        memberships: { create: { role: "ADMIN" } },
      },
    });
  }

  async register(input: {
    name: string;
    email: string;
    password: string;
    userAgent?: string;
    ip?: string;
  }): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw ApiError.conflict("An account with this email already exists", "EMAIL_TAKEN");
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        memberships: { create: { role: "TRAVELER" } },
      },
      include: { memberships: true },
    });

    await this.sendVerificationEmail(user);
    return this.issueSession(user, input.userAgent, input.ip);
  }

  async login(input: { email: string; password: string; userAgent?: string; ip?: string }): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { memberships: true },
    });

    if (!user || !user.passwordHash) {
      // Constant-ish work to avoid user-enumeration timing signals (§40).
      await verifyPassword(input.password, `scrypt$00$${"0".repeat(128)}`);
      await new Promise((r) => setTimeout(r, BCRYPT_UNKNOWN_DELAY));
      throw ApiError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw ApiError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
    }
    if (user.status === "SUSPENDED") {
      throw ApiError.forbidden("This account is suspended", "ACCOUNT_SUSPENDED");
    }

    return this.issueSession(user, input.userAgent, input.ip);
  }

  async logout(request: AuthenticatedRequest): Promise<void> {
    const raw = this.readSessionCookie(request);
    if (!raw) return;
    await this.prisma.session.deleteMany({
      where: { tokenHash: hashToken(raw) },
    });
  }

  /** Resolve the session cookie to a user, if valid. Used by the guard. */
  async resolveSession(request: AuthenticatedRequest): Promise<{ user: SessionUser; session: Session } | null> {
    const raw = this.readSessionCookie(request);
    if (!raw) return null;

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(raw) },
      include: {
        user: {
          include: { memberships: true },
        },
      },
    });

    if (!session || session.expiresAt < new Date() || session.user.status === "SUSPENDED") {
      return null;
    }

    return { user: toSessionUser(session.user), session };
  }

  async me(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });
    if (!user) throw ApiError.unauthorized();
    return toSessionUser(user);
  }

  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.unauthorized();
    if (user.emailVerifiedAt) {
      throw ApiError.badRequest("Email is already verified", "ALREADY_VERIFIED");
    }
    await this.sendVerificationEmail(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw ApiError.badRequest("Invalid or expired verification link", "INVALID_TOKEN");
    }
    await this.consumeVerification(record.id, record.userId);
  }

  /**
   * Code path: verify with the 6-digit code from the email instead of the
   * link. Same record, same expiry, same semantics.
   */
  async verifyEmailByCode(email: string, code: string): Promise<void> {
    const record = await this.findActiveTokenByEmail(email, code, "verification");
    if (!record) {
      throw ApiError.badRequest("That code is not valid or has expired", "INVALID_CODE");
    }
    await this.consumeVerification(record.id, record.userId);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always succeed silently — no account enumeration (§40).
    if (!user) return;
    const raw = generateToken();
    const code = generateCode();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        codeHash: hashToken(code),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });
    const url = `${primaryWebAppUrl()}/reset-password?token=${raw}`;
    await this.mailer.send({ to: user.email, ...resetEmail({ name: user.name, code, url }) });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw ApiError.badRequest("Invalid or expired reset link", "INVALID_TOKEN");
    }
    await this.consumeReset(record.id, record.userId, newPassword);
  }

  /** Code path: same reset, typed from the email instead of the link. */
  async resetPasswordByCode(email: string, code: string, newPassword: string): Promise<void> {
    const record = await this.findActiveTokenByEmail(email, code, "reset");
    if (!record) {
      throw ApiError.badRequest("That code is not valid or has expired", "INVALID_CODE");
    }
    await this.consumeReset(record.id, record.userId, newPassword);
  }

  async updateProfile(userId: string, input: { name?: string; phone?: string }): Promise<SessionUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: input,
      include: { memberships: true },
    });
    return toSessionUser(user);
  }

  /** Grant a role to a user (admin operations; Phase 1 admin UI consumes this). */
  async grantRole(userId: string, role: Role): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound("User not found", "USER_NOT_FOUND");
    await this.prisma.roleMembership.upsert({
      where: { userId_role: { userId, role } },
      update: { status: "ACTIVE" },
      create: { userId, role },
    });
  }

  /** ─── internals ─────────────────────────────────────────────────────────── */

  private async issueSession(
    user: User & { memberships: unknown[] },
    userAgent?: string,
    ip?: string,
  ): Promise<AuthResult> {
    const raw = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt,
        userAgent,
        ip,
      },
    });
    return {
      user: toSessionUser(user as User & { memberships: never[] }),
      sessionToken: raw,
      sessionExpiresAt: expiresAt,
    };
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const raw = generateToken();
    const code = generateCode();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        codeHash: hashToken(code),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });
    const url = `${primaryWebAppUrl()}/verify-email?token=${raw}`;
    await this.mailer.send({ to: user.email, ...verificationEmail({ name: user.name, code, url }) });
  }

  /** Consume a verification token and mark the user verified (shared path). */
  private async consumeVerification(tokenId: string, userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: tokenId },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
  }

  /** Consume a reset token, set the password, kill all sessions (shared). */
  private async consumeReset(tokenId: string, userId: string, newPassword: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: tokenId },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(newPassword) },
      }),
      // Force re-login everywhere after a reset (§40 session security).
      this.prisma.session.deleteMany({ where: { userId } }),
    ]);
  }

  /**
   * Resolve an active lifecycle token record by the user's email plus the
   * numeric code baked into their email. Unknown emails get the same lookup
   * (against a sentinel that matches nothing) so the response shape and work
   * stay constant — no enumeration signal. Codes carry one hour of life, the
   * same window as their link twin.
   */
  private async findActiveTokenByEmail(
    email: string,
    code: string,
    kind: "verification" | "reset",
  ): Promise<{ id: string; userId: string } | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const codeHash = hashToken(code);
    if (kind === "verification") {
      return this.prisma.emailVerificationToken.findFirst({
        where: {
          userId: user?.id ?? "sentinel-none",
          codeHash,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
    }
    return this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user?.id ?? "sentinel-none",
        codeHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  private readSessionCookie(request: AuthenticatedRequest): string | undefined {
    return request.cookies?.[SESSION_COOKIE];
  }
}
