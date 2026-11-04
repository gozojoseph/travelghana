import { Injectable } from "@nestjs/common";
import type { Prisma } from "@travelghana/database";
import type {
  TravelerNotificationDto,
  TravelerNotificationsResult,
} from "@travelghana/types";
import type { TravelerNotificationsQuery } from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";

/**
 * Traveler inbox (D40). The platform already writes Notification rows for
 * everything a member would otherwise only learn about from email - booking
 * requests, team acknowledgements, decisions, provider checks (D34/D36).
 * This service exposes those SAME rows back to their owner: read state is
 * the only mutation a traveler gets, emails stay the truthful record.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: TravelerNotificationsQuery,
  ): Promise<TravelerNotificationsResult> {
    const where: Prisma.NotificationWhereInput = { userId };
    const [rows, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      items: rows.map((row) => this.toDto(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
      unread,
    };
  }

  /** Unread counter for the header badge - kept separate so the nav never
   * needs the whole list. */
  async unread(userId: string): Promise<{ unread: number }> {
    const unread = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { unread };
  }

  /** Mark one own row read. Idempotent: a row that is already read keeps its
   * original readAt timestamp. */
  async markRead(
    userId: string,
    id: string,
  ): Promise<{ notification: TravelerNotificationDto }> {
    const row = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!row) throw ApiError.notFound("Notification not found");
    if (!row.readAt) {
      const readAt = new Date();
      await this.prisma.notification.update({
        where: { id: row.id },
        data: { readAt },
      });
      row.readAt = readAt;
    }
    return { notification: this.toDto(row) };
  }

  /** Mark every unread row of this member read in one shot. */
  async markAllRead(userId: string): Promise<{ marked: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { marked: result.count };
  }

  private toDto(row: {
    id: string;
    channel: "EMAIL" | "SMS" | "PUSH" | "WHATSAPP";
    type: string;
    payload: Prisma.JsonValue;
    status: string;
    sentAt: Date | null;
    readAt: Date | null;
    createdAt: Date;
  }): TravelerNotificationDto {
    return {
      id: row.id,
      channel: row.channel,
      type: row.type,
      payload: row.payload,
      status: row.status as TravelerNotificationDto["status"],
      sentAt: row.sentAt ? row.sentAt.toISOString() : null,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
