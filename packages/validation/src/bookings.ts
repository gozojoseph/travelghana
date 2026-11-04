import { z } from "zod";

/**
 * Package bookings (D25) - a signed-in traveler requests one curated package
 * journey. The API enforces: package exists and is PUBLISHED, the requested
 * start date is a real future date, and party size stays sensible.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Choose a start date" })
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), {
    message: "Choose a valid start date",
  })
  .refine((v) => new Date(`${v}T00:00:00Z`).getTime() > Date.now() - 24 * 60 * 60 * 1000, {
    message: "The start date should be in the future",
  })
  .transform((v) => new Date(`${v}T00:00:00Z`));

export const packageBookingCreateSchema = z.object({
  packageId: z.string().trim().min(20).max(64),
  startDate: isoDate,
  // Set-date journeys (D41): the chosen departure. Absent means an
  // open-dated request on a package that has no departures yet.
  departureId: z.string().trim().min(20).max(64).optional(),
  adults: z.coerce.number().int().min(1, "At least one adult").max(20),
  children: z.coerce.number().int().min(0).max(20),
  notes: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => (v === "" ? null : v))
    .optional(),
});

export type PackageBookingCreateInput = z.infer<typeof packageBookingCreateSchema>;

/**
 * What actually travels over HTTP: the schema's pre-transform input shape
 * (startDate is the plain "YYYY-MM-DD" string, not the parsed Date the server
 * derives from it). Client forms validate with the schema but submit THIS
 * shape; the API re-parses and applies the transform server-side (D25 fix:
 * submitting the transformed value serialized an ISO datetime that the
 * server's date-only validation rejects).
 */
export type PackageBookingCreateWire = z.input<typeof packageBookingCreateSchema>;

const BOOKING_STATUS_VALUES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "EXPIRED",
] as const;

export const packageBookingListQuerySchema = z.object({
  status: z.enum(BOOKING_STATUS_VALUES).optional(),
});

export type PackageBookingListQuery = z.infer<typeof packageBookingListQuerySchema>;

/**
 * Admin outreach on a booking (D36): acknowledgement, concern and the
 * availability decision. Confirmations/cancellations are allowed only for
 * payment-pending requests; later transitions belong to the payment rails.
 */
export const adminBookingAcknowledgeSchema = z.object({
  message: z
    .string()
    .trim()
    .max(1000, "Keep the note under 1000 characters")
    .optional(),
});

export type AdminBookingAcknowledgeInput = z.infer<typeof adminBookingAcknowledgeSchema>;

export const adminBookingConcernSchema = z.object({
  message: z
    .string()
    .trim()
    .min(2, "Write the concern you want to send")
    .max(1000, "Keep the concern under 1000 characters"),
});

export type AdminBookingConcernInput = z.infer<typeof adminBookingConcernSchema>;

export const adminBookingDecisionSchema = z.object({
  decision: z.enum(["CONFIRMED", "CANCELLED"]),
  reason: z
    .string()
    .trim()
    .max(500, "Keep the reason under 500 characters")
    .optional(),
});

export type AdminBookingDecisionInput = z.infer<typeof adminBookingDecisionSchema>;
