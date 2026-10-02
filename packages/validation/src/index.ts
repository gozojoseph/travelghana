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
