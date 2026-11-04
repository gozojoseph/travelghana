import { z } from "zod";

/**
 * Package reviews (D42). A traveler may write a review only when the team
 * CONFIRMED one of their bookings for that package; the API double-checks
 * that gate server-side. Every submission lands PENDING in the moderation
 * queue - nothing goes public without an admin approving it.
 */

const idField = z.string().trim().min(20).max(64);

export const reviewCreateSchema = z.object({
  packageId: idField,
  rating: z.coerce.number().int().min(1, "Pick a star rating").max(5, "Pick a star rating"),
  body: z
    .string()
    .trim()
    .max(2000, "Keep your review under 2000 characters")
    .transform((v) => (v === "" ? null : v))
    .optional(),
});

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

export const reviewEligibilityQuerySchema = z.object({
  packageId: idField,
});

export type ReviewEligibilityQuery = z.infer<typeof reviewEligibilityQuerySchema>;

/** Moderation queue filter (D42): which bucket the console is looking at. */
export const adminReviewListQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export type AdminReviewListQuery = z.infer<typeof adminReviewListQuerySchema>;

export const adminReviewDecisionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(2, "Write the reason (it is kept on the record)")
    .max(500, "Keep the reason under 500 characters"),
});

export type AdminReviewDecisionInput = z.infer<typeof adminReviewDecisionSchema>;

/** Public list addressed by the package's slug (like the detail page). */
export const reviewListQuerySchema = z.object({
  packageSlug: z.string().trim().min(1).max(120),
});

export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
