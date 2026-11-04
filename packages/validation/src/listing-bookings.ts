import { z } from "zod";

/**
 * Transport listing requests (D43) - a signed-in traveler asks about one
 * published listing owned by a transport provider (transport company or
 * driver partner). Everything is quote-based: no prices, seats or payment
 * fields exist here; the team replies with a written quote by email.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Choose a travel date" })
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), {
    message: "Choose a valid travel date",
  })
  .refine((v) => new Date(`${v}T00:00:00Z`).getTime() > Date.now() - 24 * 60 * 60 * 1000, {
    message: "The travel date should be in the future",
  })
  .transform((v) => new Date(`${v}T00:00:00Z`));

export const listingRequestCreateSchema = z.object({
  listingId: z.string().trim().min(20).max(64),
  startDate: isoDate,
  partySize: z.coerce
    .number()
    .int()
    .min(1, "At least one traveler")
    .max(40, "For groups above 40 people the team will plan with you directly"),
  notes: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => (v === "" ? null : v))
    .optional(),
});

export type ListingRequestCreateInput = z.infer<typeof listingRequestCreateSchema>;

/**
 * What actually travels over HTTP: the schema's pre-transform input shape
 * (startDate stays the plain "YYYY-MM-DD" string). Client forms validate with
 * the schema but submit THIS shape; the API re-parses and applies the
 * transform server-side (same pattern as the package booking wire type).
 */
export type ListingRequestCreateWire = z.input<typeof listingRequestCreateSchema>;

export const listingRequestStatusValues = ["PENDING", "CONFIRMED", "CANCELLED"] as const;
export type ListingRequestStatus = (typeof listingRequestStatusValues)[number];

export const listingRequestListQuerySchema = z.object({
  status: z.enum(listingRequestStatusValues).optional(),
});

export type ListingRequestListQuery = z.infer<typeof listingRequestListQuerySchema>;

/**
 * The team's written quote for a request (sent by email, kept on the row).
 * No amounts are required or asserted by the platform - the text is freeform
 * and the quote conversation stays with the traveler.
 */
export const listingRequestQuoteSchema = z.object({
  message: z
    .string()
    .trim()
    .min(2, "Write the quote you want to send")
    .max(2000, "Keep the quote under 2000 characters"),
});

export type ListingRequestQuoteInput = z.infer<typeof listingRequestQuoteSchema>;

export const listingRequestDecisionSchema = z.object({
  decision: z.enum(["CONFIRMED", "CANCELLED"]),
  message: z
    .string()
    .trim()
    .max(1000, "Keep the message under 1000 characters")
    .optional(),
});

export type ListingRequestDecisionInput = z.infer<typeof listingRequestDecisionSchema>;
