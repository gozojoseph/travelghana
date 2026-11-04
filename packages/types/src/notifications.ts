/**
 * Traveler notifications (D40) - DTOs for the member-facing inbox over the
 * shared Notification outbox table. The traveler sees only their own rows;
 * payload stays unknown on purpose (contents vary per notification type).
 */
import type { NotificationStatusValue } from "./admin";

export interface TravelerNotificationDto {
  id: string;
  channel: "EMAIL" | "SMS" | "PUSH" | "WHATSAPP";
  type: string;
  payload: unknown;
  status: NotificationStatusValue;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface TravelerNotificationsResult {
  items: TravelerNotificationDto[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  unread: number;
}
