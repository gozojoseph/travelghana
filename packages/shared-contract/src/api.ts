import { z } from "zod";

/** Shared zod contract — the only source of truth for the web app. */
export const roleSchema = z.enum([
  "TRAVELER",
  "DRIVER",
  "TOUR_OPERATOR",
  "HOTEL_MANAGER",
  "TRANSPORT_COMPANY",
  "EXPERIENCE_PROVIDER",
  "ADMIN",
]);

export const verificationStatusSchema = z.enum([
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "SUSPENDED",
]);

export const bookingStatusSchema = z.enum([
  "REQUESTED",
  "PAID",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "EXPIRED",
]);

export const reviewStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

export const listingTypeSchema = z.enum([
  "TOUR",
  "EXPERIENCE",
  "TRANSPORT",
  "HOTEL",
  "EVENT",
]);

export const moneySchema = z.object({
  amountMinor: z.number().int().min(0),
  currencyCode: z.string().length(3).regex(/^[A-Z]{3}$/, "must be 3 uppercase letters"),
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullish(),
  avatarUrl: z.string().url().nullish(),
  phone: z.string().nullish(),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  emailVerified: z.boolean(),
  createdAt: z.string(),
});

export const providerSchema = z.object({
  id: z.string(),
  type: z.enum(["TOUR_OPERATOR", "HOTEL", "EXPERIENCE_PROVIDER", "TRANSPORT_COMPANY"]),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullish(),
  verificationStatus: verificationStatusSchema,
  contactEmail: z.string().email().nullish(),
  contactPhone: z.string().nullish(),
  cityId: z.string().nullish(),
  serviceArea: z.string().nullish(),
  coordinatesLat: z.number().nullish(),
  coordinatesLng: z.number().nullish(),
  country: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const citySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  region: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    })
    .nullish(),
});

export const regionSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  cities: z.array(citySchema).nullish(),
});

export const listingSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  serviceArea: z.string().nullish(),
  cityId: z.string().nullish(),
  regionId: z.string().nullish(),
  coordinatesLat: z.number().nullish(),
  coordinatesLng: z.number().nullish(),
  address: z.string().nullish(),
  category: z.string().nullish(),
  whatIsIncluded: z.string().nullish(),
  whatIsExcluded: z.string().nullish(),
  requirements: z.string().nullish(),
  cancellationPolicy: z.string().nullish(),
  heroImageUrl: z.string().url().nullish(),
  priceMinor: z.number().int().min(0),
  currencyCode: z.string().length(3).regex(/^[A-Z]{3}$/),
  durationMinutes: z.number().int().min(1).nullish(),
  capacity: z.number().int().min(1),
  verificationStatus: verificationStatusSchema,
  published: z.boolean(),
  publishedAt: z.string().nullish(),
  publishedByAdminId: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listingSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  serviceArea: z.string().nullish(),
  cityId: z.string().nullish(),
  regionId: z.string().nullish(),
  coordinatesLat: z.number().nullish(),
  coordinatesLng: z.number().nullish(),
  address: z.string().nullish(),
  category: z.string().nullish(),
  whatIsIncluded: z.string().nullish(),
  whatIsExcluded: z.string().nullish(),
  requirements: z.string().nullish(),
  cancellationPolicy: z.string().nullish(),
  heroImageUrl: z.string().url().nullish(),
  priceMinor: z.number().int().min(0),
  currencyCode: z.string().length(3).regex(/^[A-Z]{3}$/),
  durationMinutes: z.number().int().min(1).nullish(),
  capacity: z.number().int().min(1),
  verificationStatus: verificationStatusSchema,
  published: z.boolean(),
  publishedAt: z.string().nullish(),
  publishedByAdminId: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
  provider: providerSchema
    .pick({ id: true, name: true, slug: true, verificationStatus: true })
    .partial()
    .refine((v) => v.name !== undefined, {
      message: "provider.name is required",
    }),
  city: citySchema.pick({ id: true, name: true, slug: true }).partial().nullish(),
  region: regionSchema.pick({ id: true, name: true, slug: true }).partial().nullish(),
});

export const bookingSchema = z.object({
  id: z.string(),
  code: z.string(),
  userId: z.string(),
  providerId: z.string(),
  listingId: z.string(),
  city: z.string(),
  adults: z.number().int().min(1),
  children: z.number().int().min(0).default(0),
  totalMinor: z.number().int().min(0),
  currencyCode: z.string().length(3).regex(/^[A-Z]{3}$/),
  status: bookingStatusSchema,
  reviewStatus: reviewStatusSchema,
  specialRequests: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listingReviewSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  reviewerId: z.string(),
  comment: z.string().nullish(),
  status: reviewStatusSchema,
  note: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Root form input for booking a listing. */
export const bookingFormSchema = z.object({
  listingId: z.string(),
  city: z.string(),
  adults: z.number().int().min(1),
  children: z.number().int().min(0).default(0),
  specialRequests: z.string().max(2000).nullish(),
});

export type BookingFormInput = z.infer<typeof bookingFormSchema>;
