import { z } from "zod";

/** Shared zod schemas — used by API controllers and web forms alike. */

export const emailSchema = z.string().trim().toLowerCase().email();

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z.string().trim().max(30).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  adults: z.number().int().min(1).max(30).default(1),
  children: z.number().int().min(0).max(20).default(0),
  destinations: z.array(z.string().trim().min(1)).max(20).default([]),
  interests: z.array(z.string().trim().min(1)).max(20).default([]),
  budgetRange: z.string().trim().max(60).optional(),
  accommodationPref: z.string().trim().max(500).optional(),
  transportPref: z.string().trim().max(500).optional(),
  specialRequests: z.string().trim().max(2000).optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10).max(200),
});

export const resendVerificationSchema = z.object({}).passthrough();

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().max(30).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes provided" });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EnquiryInput = z.infer<typeof enquirySchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Destinations / explore ─────────────────────────────────────────────────

export const destinationListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  category: z
    .enum(["BEACH", "HISTORICAL", "CULTURAL", "NATURE", "CITY", "FOOD", "ADVENTURE"])
    .optional(),
  featured: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

export const destinationSlugSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug")
    .max(120),
});

export type DestinationListQuery = z.infer<typeof destinationListQuerySchema>;
export type DestinationSlugParams = z.infer<typeof destinationSlugSchema>;

// ─── Operator onboarding + listings (D5 operator-first; MVP = tours + experiences) ───

/** Provider types a user can self-onboard as. DRIVER_PARTNER is deferred to the
 *  driver module; EVENT_ORGANIZER / RESTAURANT have no matching Role enum member
 *  yet, so they are offered once RBAC grows those roles. */
export const ONBOARDABLE_PROVIDER_TYPES = [
  "TOUR_OPERATOR",
  "HOTEL",
  "EXPERIENCE_PROVIDER",
  "TRANSPORT_COMPANY",
] as const;

export const providerOnboardSchema = z.object({
  type: z.enum(ONBOARDABLE_PROVIDER_TYPES),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  contactEmail: emailSchema.optional(),
  contactPhone: z.string().trim().max(30).optional(),
  cityId: z.string().trim().min(1).max(64).optional(),
});

export const providerUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    contactEmail: emailSchema.optional(),
    contactPhone: z.string().trim().max(30).optional(),
    cityId: z.string().trim().min(1).max(64).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes provided" });

// ─── Reusable listing (provider onboarding + listings increment) ─────────────

const currency = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]{3}$/, "currencyCode must be a 3-letter ISO 4217 code")
  .default("GHS");

const tourBaseSchema = z.object({
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().max(280).optional(),
  description: z.string().trim().max(5000).optional(),
  durationHours: z.number().int().min(1).max(720).optional(),
  days: z.number().int().min(1).max(30).optional(),
  groupMin: z.number().int().min(1).max(50).default(1),
  groupMax: z.number().int().min(1).max(100).default(10),
  basePriceMinor: z.number().int().min(0).max(2_000_000_000),
  currencyCode: currency,
  cityId: z.string().trim().min(1).max(64).optional(),
  meetingPoint: z.string().trim().max(200).optional(),
  category: z.string().trim().max(60).optional(),
  published: z.boolean().optional(),
});

export const tourCreateSchema = tourBaseSchema.refine((v) => v.groupMax >= v.groupMin, {
  message: "groupMax must be greater than or equal to groupMin",
  path: ["groupMax"],
});

// Partial, without the cross-field refine (fields may be absent on update).
export const tourUpdateSchema = tourBaseSchema.partial();

export const experienceCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000).optional(),
  durationMinutes: z.number().int().min(15).max(1440).optional(),
  priceMinor: z.number().int().min(0).max(2_000_000_000),
  currencyCode: currency,
  cityId: z.string().trim().min(1).max(64).optional(),
  category: z.string().trim().max(60).optional(),
  published: z.boolean().optional(),
});

export const experienceUpdateSchema = experienceCreateSchema.partial();

export const idParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

// ─── Public catalog (browse published listings) ─────────────────────────────

export const catalogListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  category: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

export const providerListingSlugSchema = z.object({
  providerSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid provider slug")
    .max(120),
  listingSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid listing slug")
    .max(120),
});

// ─── Reusable listing (provider dashboard + admin queue) ────────────────────

/** Query param for filtering a provider's / the admin queue's listing list. */
export const listingStatusQuerySchema = z.object({
  id: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "PAUSED", "ARCHIVED"]).optional(),
});

const coordinateMinorSchema = z
  .string()
  .trim()
  .transform((v) => Math.round(Number.parseFloat(v) * 100))
  .refine((n) => Number.isFinite(n), { message: "Must be a number" });

// Coordinates are stored as integer minor units (pesewas) at the API layer;
// the UI sends and receives cedi strings. Here we parse to minor units so
// the DB and DTOs stay integer-only (D8).
const listingBaseSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000).optional(),
  serviceArea: z.string().trim().max(1000).optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  capacity: z.number().int().min(1).max(10000).default(1),
  priceMinor: z.number().int().min(0).max(2_000_000_000),
  currencyCode: currency,
  cityId: z.string().trim().min(1).max(64).optional(),
  regionId: z.string().trim().min(1).max(64).optional(),
  coordinatesLat: coordinateMinorSchema.optional(),
  coordinatesLng: coordinateMinorSchema.optional(),
  address: z.string().trim().max(300).optional(),
  meetingPoint: z.string().trim().max(200).optional(),
  category: z.string().trim().max(60).optional(),
  whatIsIncluded: z.string().trim().max(5000).optional(),
  whatIsExcluded: z.string().trim().max(5000).optional(),
  requirements: z.string().trim().max(5000).optional(),
  cancellationPolicy: z.string().trim().max(2000).optional(),
  heroImageUrl: z.string().trim().url().max(500).optional(),
  published: z.boolean().optional(),
});

export const listingCreateSchema = listingBaseSchema.refine((v) => v.capacity >= 1, {
  message: "capacity must be at least 1",
  path: ["capacity"],
});

// Partial, without the cross-field refine (fields may be absent on update).
// Optional fields are `string | undefined` (not `string | null`).
export const listingUpdateSchema = listingBaseSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No changes provided" });

export const statusTransitionSchema = z
  .object({
    status: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "PAUSED", "ARCHIVED"]).optional(),
  })
  .refine((v) => v.status !== undefined, { message: "Missing status" });

export const reviewActionSchema = z
  .object({
    reviewStatus: z.enum(["APPROVE", "REJECT", "SUSPEND"]),
  })
  .refine((v) => v.reviewStatus !== undefined, { message: "Missing reviewStatus" });

export type CatalogListQuery = z.infer<typeof catalogListQuerySchema>;
export type ProviderListingSlugParams = z.infer<typeof providerListingSlugSchema>;
export type ListingStatusQuery = z.infer<typeof listingStatusQuerySchema>;
export type ProviderOnboardInput = z.infer<typeof providerOnboardSchema>;
export type ProviderUpdateInput = z.infer<typeof providerUpdateSchema>;
export type ListingCreateInput = z.infer<typeof listingCreateSchema>;
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;
export type ListingStatusInput = z.infer<typeof statusTransitionSchema>;
export type ReviewActionInput = z.infer<typeof reviewActionSchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type TourCreateInput = z.infer<typeof tourCreateSchema>;
export type TourUpdateInput = z.infer<typeof tourUpdateSchema>;
export type ExperienceCreateInput = z.infer<typeof experienceCreateSchema>;
export type ExperienceUpdateInput = z.infer<typeof experienceUpdateSchema>;
