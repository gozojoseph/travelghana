import { Injectable } from "@nestjs/common";
import type { Prisma } from "@travelghana/database";
import type {
  AdminNotificationDto,
  AdminNotificationsResult,
} from "@travelghana/types";
import type { AdminNotificationsQuery } from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";

/**
 * Notification outbox (§Admin notifications). Honest scope (D20): queued
 * records - no delivery provider is wired, so no resend/retry control, only
 * visibility. D28 gives admins a cleanup path: QUEUED and FAILED records can
 * be deleted (audited); SENT records are delivery history and stay immutable.
 */
@Injectable()
export class AdminNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminNotificationsQuery): Promise<AdminNotificationsResult> {
    const where: Prisma.NotificationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: { contains: query.type, mode: "insensitive" } } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { user: { select: { email: true } } },
      }),
      this.prisma.notification.count({ where }),
    ]);

    const items: AdminNotificationDto[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      userEmail: row.user?.email ?? null,
      channel: row.channel,
      type: row.type,
      payload: row.payload,
      status: row.status as AdminNotificationDto["status"],
      sentAt: row.sentAt?.toISOString() ?? null,
      readAt: row.readAt?.toISOString() ?? null,
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

  /** Outbox cleanup (D28): QUEUED/FAILED records only - SENT is history. */
  async remove(adminId: string, id: string): Promise<{ message: string }> {
    const row = await this.prisma.notification.findUnique({
      where: { id },
      select: { id: true, status: true, type: true, userId: true },
    });
    if (!row) throw ApiError.notFound("Notification not found");
    if (row.status === "SENT") {
      throw ApiError.conflict(
        "Sent notifications are delivery history and cannot be deleted",
        "SENT_RECORD_IMMUTABLE",
      );
    }

    await this.prisma.notification.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "NOTIFICATION_DELETED",
        entityType: "Notification",
        entityId: row.id,
        meta: { type: row.type, status: row.status, userId: row.userId },
      },
    });
    return { message: "Notification deleted" };
  }
}
