import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { Role, Session, User } from "@travelghana/database";
import type { AuthResponse, SessionUser } from "@travelghana/types";
import { createHash } from "crypto";

import { ApiError } from "../../common/errors/api-error";
import { toSessionUser } from "../../common/mappers/session-user.mapper";
import { PrismaService } from "../../common/prisma.service";
import type { AuthenticatedRequest } from "../../common/guards/session.guard";

import { MAILER, Mailer } from "./mailer";
import { generateToken, hashPassword, hashToken, verifyPassword } from "./passwords";

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
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always succeed silently — no account enumeration (§40).
    if (!user) return;
    const raw = generateToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });
    const url = `${process.env.WEB_APP_URL ?? "http://localhost:3000"}/reset-password?token=${raw}`;
    await this.mailer.send({
      to: user.email,
      subject: "Reset your TravelGhana password",
      text: `Hi${user.name ? ` ${user.name}` : ""},\n\nReset your password: ${url}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw ApiError.badRequest("Invalid or expired reset link", "INVALID_TOKEN");
    }
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(newPassword) },
      }),
      // Force re-login everywhere after a reset (§40 session security).
      this.prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);
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
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });
    const url = `${process.env.WEB_APP_URL ?? "http://localhost:3000"}/verify-email?token=${raw}`;
    await this.mailer.send({
      to: user.email,
      subject: "Verify your TravelGhana email",
      text: `Welcome to TravelGhana!\n\nVerify your email: ${url}\n\nThis link expires in 1 hour.`,
    });
  }

  private readSessionCookie(request: AuthenticatedRequest): string | undefined {
    return request.cookies?.[SESSION_COOKIE];
  }
}
