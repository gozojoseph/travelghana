import { z } from "zod";

/**
 * Traveler notifications (D40) - the signed-in member reads back the same
 * outbox records the platform already writes (booking lifecycle, decisions,
 * team notes). Read state is the only thing a traveler can change: marking
 * rows read writes readAt; nothing else is mutable from this surface.
 */

export const travelerNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type TravelerNotificationsQuery = z.infer<typeof travelerNotificationsQuerySchema>;
