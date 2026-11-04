import { z } from "zod";

/**
 * Curated package validation — shared by the admin API and the admin web form.
 * Prices are integer minor units (D8); the UI converts cedi strings first.
 */

export const PACKAGE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export const packageStatusSchema = z.enum(PACKAGE_STATUSES);

const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]{3}$/, "currencyCode must be a 3-letter ISO 4217 code")
  .default("GHS");

export const packageDayInputSchema = z.object({
  dayNumber: z.number().int().min(1).max(30),
  title: z.string().trim().min(1, "Give this day a title").max(140),
  description: z.string().trim().max(2000).optional(),
  meals: z.string().trim().max(200).optional(),
  accommodation: z.string().trim().max(200).optional(),
});

const packageBaseSchema = z.object({
  title: z.string().trim().min(3, "Give the package a title").max(160),
  summary: z.string().trim().max(300).optional(),
  description: z.string().trim().max(8000).optional(),
  /** Null clears the destination on update. */
  destinationId: z.string().trim().min(1).max(64).nullable().optional(),
  durationDays: z.number().int().min(1).max(30),
  durationNights: z.number().int().min(0).max(29),
  priceMinor: z.number().int().min(0).max(2_000_000_000),
  currencyCode: currencyCodeSchema,
  heroImageUrl: z.string().trim().url("Enter a valid image URL").max(500).nullable().optional(),
  inclusions: z.string().trim().max(5000).optional(),
  exclusions: z.string().trim().max(5000).optional(),
  featured: z.boolean().optional(),
  days: z.array(packageDayInputSchema).max(30).optional(),
});

function dayNumbersAreUnique(days: { dayNumber: number }[] | undefined): boolean {
  if (!days) return true;
  return new Set(days.map((day) => day.dayNumber)).size === days.length;
}

function nightsBeforeDays(days: number | undefined, nights: number | undefined): boolean {
  if (days === undefined || nights === undefined) return true;
  return nights < days;
}

export const packageCreateSchema = packageBaseSchema
  .refine((value) => nightsBeforeDays(value.durationDays, value.durationNights), {
    message: "Nights must be fewer than days",
    path: ["durationNights"],
  })
  .refine((value) => dayNumbersAreUnique(value.days), {
    message: "Day numbers must be unique",
    path: ["days"],
  });

export const packageUpdateSchema = packageBaseSchema
  .partial()
  .extend({ status: packageStatusSchema.optional() })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes provided" })
  .refine((value) => nightsBeforeDays(value.durationDays, value.durationNights), {
    message: "Nights must be fewer than days",
    path: ["durationNights"],
  })
  .refine((value) => dayNumbersAreUnique(value.days), {
    message: "Day numbers must be unique",
    path: ["days"],
  });

export const packageListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: packageStatusSchema.optional(),
});

/** Public package pages address packages by slug, never by internal id. */
export const packageSlugParamSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

export type PackageStatusInput = z.infer<typeof packageStatusSchema>;
export type PackageDayInput = z.infer<typeof packageDayInputSchema>;
export type PackageCreateInput = z.infer<typeof packageCreateSchema>;
export type PackageUpdateInput = z.infer<typeof packageUpdateSchema>;
export type PackageListQuery = z.infer<typeof packageListQuerySchema>;
export type PackageSlugParam = z.infer<typeof packageSlugParamSchema>;

// ─── Departures (D41: set-date journeys with seat counts) ────────────────────

/** "YYYY-MM-DD" parsed at UTC midnight, exactly like booking start dates. */
const departureDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Pick a departure date" })
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), {
    message: "Pick a valid departure date",
  })
  .refine((v) => new Date(`${v}T00:00:00Z`).getTime() > Date.now() - 24 * 60 * 60 * 1000, {
    message: "The departure must be in the future",
  })
  .transform((v) => new Date(`${v}T00:00:00Z`));

const seatsField = z.coerce.number().int().min(1, "Set how many seats are available").max(200);

const departurePackageId = z.string().trim().min(20).max(64);

export const departureCreateSchema = z.object({
  packageId: departurePackageId,
  startDate: departureDate,
  seats: seatsField,
});

export type DepartureCreateInput = z.infer<typeof departureCreateSchema>;

/**
 * Weekly quick-add: same weekday and seat count for N further weeks, so a
 * recurring journey does not need date-by-date entry. Dates that already
 * have a departure are skipped (the response reports what was created).
 */
export const departureBulkCreateSchema = z.object({
  packageId: departurePackageId,
  startDate: departureDate,
  seats: seatsField,
  weeks: z.coerce.number().int().min(1, "Add at least one week").max(12),
});

export type DepartureBulkCreateInput = z.infer<typeof departureBulkCreateSchema>;

/** Seat-count corrections only; moving a date is delete + re-add. */
export const departureUpdateSchema = z.object({
  seats: seatsField,
});

export type DepartureUpdateInput = z.infer<typeof departureUpdateSchema>;

/** Nested admin route params: the package plus one of its departures. */
export const departureParamsSchema = z.object({
  id: departurePackageId,
  departureId: z.string().trim().min(20).max(64),
});

export type DepartureParams = z.infer<typeof departureParamsSchema>;

