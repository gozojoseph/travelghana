import { Injectable } from "@nestjs/common";
import type { Prisma } from "@travelghana/database";
import type { AdminUserDto, AdminUsersResult } from "@travelghana/types";
import type { AdminUserUpdateInput, AdminUsersQuery } from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";

type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    memberships: true;
    provider: { select: { id: true } };
  };
}>;

/**
 * Admin user management (D20 Phase 3). Roles are RoleMembership rows; an
 * "active role" is a membership with status ACTIVE. Two written-down
 * guardrails keep the console from locking itself out:
 *  - an admin cannot suspend their own account, and
 *  - removing an ADMIN membership can never leave zero active admins.
 */
@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminUsersQuery): Promise<AdminUsersResult> {
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: "insensitive" } },
              { name: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          memberships: { orderBy: { createdAt: "asc" } },
          provider: { select: { id: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toDto(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  /**
   * Admin-only mutations in one endpoint: grant roles, revoke roles, and
   * suspend/reactivate. Enforcement of SUSPENDED is already built into auth
   * (login rejects it and the session guard drops the session), so no extra
   * bookkeeping is needed here — only the audit trail.
   */
  async update(
    actingAdminId: string,
    userId: string,
    input: AdminUserUpdateInput,
  ): Promise<{ user: AdminUserDto; message: string }> {
    const user = await this.findUser(userId);
    if (!user) throw ApiError.notFound("User not found");

    // ── Guardrails ──────────────────────────────────────────────────────
    if (user.id === actingAdminId && input.status === "SUSPENDED") {
      throw ApiError.conflict("You cannot suspend your own account", "SELF_SUSPEND");
    }

    const removesAdmin = input.removeRoles?.includes("ADMIN") ?? false;
    if (removesAdmin && user.id === actingAdminId) {
      throw ApiError.conflict("You cannot remove your own ADMIN role", "SELF_DEMOTE");
    }
    if (removesAdmin) {
      const activeAdmins = await this.prisma.roleMembership.count({
        where: { role: "ADMIN", status: "ACTIVE" },
      });
      // Membership rows are unique per (userId, role); count them, minus one
      // when this target actually holds an active one. A PENDING admin
      // membership never grants the role, so it must not keep the count up.
      const targetActiveAdmin = user.memberships.some(
        (m) => m.role === "ADMIN" && m.status === "ACTIVE",
      );
      if (activeAdmins - (targetActiveAdmin ? 1 : 0) < 1) {
        throw ApiError.conflict(
          "Cannot remove the last active ADMIN membership",
          "LAST_ADMIN",
        );
      }
    }

    // ── Apply changes ───────────────────────────────────────────────────
    const changes: string[] = [];

    if (input.addRoles?.length) {
      for (const role of input.addRoles) {
        const existing = user.memberships.find((m) => m.role === role);
        if (existing) {
          if (existing.status !== "ACTIVE") {
            await this.prisma.roleMembership.update({
              where: { id: existing.id },
              data: { status: "ACTIVE" },
            });
            changes.push(`activated ${role}`);
          }
        } else {
          await this.prisma.roleMembership.create({
            data: { userId: user.id, role, status: "ACTIVE" },
          });
          changes.push(`added ${role}`);
        }
      }
    }

    if (input.removeRoles?.length) {
      for (const role of input.removeRoles) {
        const existing = user.memberships.find((m) => m.role === role);
        if (!existing || existing.status !== "ACTIVE") continue;
        // The membership row is kept as history; revocation flips status.
        await this.prisma.roleMembership.update({
          where: { id: existing.id },
          data: { status: "SUSPENDED" },
        });
        changes.push(`removed ${role}`);
      }
    }

    if (input.status && input.status !== user.status) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { status: input.status },
      });
      // ASCII arrow: audit JSON must survive the local WIN1252 client
      // encoding, which has no glue for characters like "→".
      changes.push(`status ${user.status} -> ${input.status}`);
    }

    const updated = await this.findUser(user.id);
    if (changes.length > 0) {
      await this.audit(actingAdminId, user.id, {
        addRoles: input.addRoles ?? [],
        removeRoles: input.removeRoles ?? [],
        status: input.status ?? null,
        outcome: changes,
      });
    }

    return { user: this.toDto(updated!), message: changes.join(", ") || "No changes" };
  }

  private findUser(userId: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { orderBy: { createdAt: "asc" } },
        provider: { select: { id: true } },
      },
    });
  }

  private toDto(row: UserWithRoles): AdminUserDto {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      phone: row.phone,
      status: row.status,
      emailVerified: row.emailVerifiedAt !== null,
      createdAt: row.createdAt.toISOString(),
      roles: row.memberships
        .filter((m) => m.status === "ACTIVE")
        .map((m) => m.role),
      memberships: row.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
      providerId: row.provider?.id ?? null,
    };
  }

  private async audit(
    actorUserId: string,
    entityId: string,
    meta: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { actorUserId, action: "USER_UPDATED", entityType: "User", entityId, meta },
    });
  }
}
