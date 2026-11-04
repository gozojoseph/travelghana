import { z } from "zod";

/** Maps the Prisma schema to the shared contract. */
export const roleSchema = z.enum([
  "TRAVELER",
  "DRIVER",
  "TOUR_OPERATOR",
  "HOTEL_MANAGER",
  "TRANSPORT_COMPANY",
  "EXPERIENCE_PROVIDER",
  "ADMIN",
]);

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  passwordHash: z.string().nullable(),
  emailVerifiedAt: z.string().nullable(),
  phone: z.string().nullable(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const providerSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  type: z.enum(["TOUR_OPERATOR", "HOTEL", "EXPERIENCE_PROVIDER", "TRANSPORT_COMPANY"]),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED", "SUSPENDED"]),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  cityId: z.string().nullable(),
  serviceArea: z.string().nullable(),
  coordinatesLat: z.number().nullable(),
  coordinatesLng: z.number().nullable(),
  country: z.string().default("Ghana"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listingSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  serviceArea: z.string().nullable(),
  category: z.string().nullable(),
  whatIsIncluded: z.string().nullable(),
  whatIsExcluded: z.string().nullable(),
  requirements: z.string().nullable(),
  cancellationPolicy: z.string().nullable(),
  heroImageUrl: z.string().nullable(),
  priceMinor: z.number().int().min(0),
  currencyCode: z.string().default("GHS"),
  durationMinutes: z.number().int().min(1).nullable(),
  capacity: z.number().int().min(1),
  verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED", "SUSPENDED"]),
  published: z.boolean().default(false),
  publishedAt: z.string().nullable(),
  publishedByAdminId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const bookingSchema = z.object({
  id: z.string(),
  code: z.string(),
  userId: z.string(),
  providerId: z.string(),
  listingId: z.string(),
  city: z.string(),
  adults: z.number().int().min(1),
  children: z.number().int().min(0),
  totalMinor: z.number().int().min(0),
  currencyCode: z.string().default("GHS"),
  status: z.enum(["REQUESTED", "PAID", "CONFIRMED", "COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"]),
  reviewStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  specialRequests: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listingReviewSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  reviewerId: z.string(),
  comment: z.string().nullable(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const reviewSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  authorUserId: z.string(),
  reviewedUserId: z.string(),
  targetType: z.enum(["TOUR", "EXPERIENCE", "HOTEL", "EVENT"]),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
