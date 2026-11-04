import { Injectable } from "@nestjs/common";
import type { Prisma } from "@travelghana/database";
import type { AdminAuditDto, AdminAuditResult } from "@travelghana/types";
import type { AdminAuditQuery } from "@travelghana/validation";

import { PrismaService } from "../../common/prisma.service";

/** Read-only audit trail (§Activity). Every mutation in the console lands here. */
@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminAuditQuery): Promise<AdminAuditResult> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actor ? { actorUserId: query.actor } : {}),
      ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { actor: { select: { email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const items: AdminAuditDto[] = rows.map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      actorEmail: row.actor?.email ?? null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      meta: row.meta,
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }
}
