import { z } from "zod";

/**
 * Trip planner validation — shared by the web forms and the API (one schema,
 * no duplication). Enum value arrays are exported so the UI can render
 * pickers without re-declaring options.
 */

export const MAX_TRIP_DAYS = 30;

export const needCategorySchema = z.enum([
  "ACCESSIBILITY",
  "MOBILITY",
  "DIETARY",
  "ALLERGY",
  "CHILDREN",
  "SENIOR",
  "PREGNANCY",
  "MEDICATION",
  "ASSISTANCE",
  "OTHER",
]);

export const itineraryItemTypeSchema = z.enum([
  "ATTRACTION",
  "RESTAURANT",
  "EVENT",
  "NOTE",
  "TRANSPORT",
  "ACCOMMODATION",
  "TOUR",
  "EXPERIENCE",
]);

/** Planner preference option lists (wizard + item editor). */
export const TRAVEL_PACE_VALUES = ["RELAXED", "BALANCED", "PACKED"] as const;
export const BUDGET_TIER_VALUES = ["BUDGET", "MIDRANGE", "PREMIUM", "FLEXIBLE"] as const;
export const BUDGET_TYPE_VALUES = ["PER_PERSON", "PER_GROUP"] as const;
export const TRIP_INTEREST_VALUES = [
  "CULTURE_HERITAGE",
  "BEACHES_COASTAL",
  "NATURE_WILDLIFE",
  "ADVENTURE_HIKING",
  "FOOD_CUISINE",
  "FESTIVALS_EVENTS",
  "ART_CRAFTS_SHOPPING",
  "NIGHTLIFE_ENTERTAINMENT",
  "RELAXATION_WELLNESS",
  "FAMILY_FRIENDLY",
] as const;
export const PRICING_BASIS_VALUES = [
  "PER_PERSON",
  "PER_GROUP",
  "PER_NIGHT",
  "PER_SERVICE",
  "TOTAL",
] as const;
export const ESTIMATE_SOURCE_VALUES = ["LISTING", "MANUAL"] as const;

export const travelPaceSchema = z.enum(TRAVEL_PACE_VALUES);
export const budgetTierSchema = z.enum(BUDGET_TIER_VALUES);
export const budgetTypeSchema = z.enum(BUDGET_TYPE_VALUES);
export const tripInterestSchema = z.enum(TRIP_INTEREST_VALUES);
export const pricingBasisSchema = z.enum(PRICING_BASIS_VALUES);
export const estimateSourceSchema = z.enum(ESTIMATE_SOURCE_VALUES);

/** Date-only string (YYYY-MM-DD) — no times, no timezone ambiguity. */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Enter a valid calendar date");

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the HH:mm format");

const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]{3}$/, "currencyCode must be a 3-letter ISO 4217 code");

function daysInclusive(start: string, end: string): number {
  const diff = Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`);
  return Math.floor(diff / 86_400_000) + 1;
}

// ─── Trip ─────────────────────────────────────────────────────────────────────

const tripNameSchema = z.string().trim().min(2, "Give your trip a name").max(120);
const nullableDateSchema = dateOnlySchema.nullable().optional();
const nullableNotesSchema = z.string().trim().max(2000).nullable().optional();
const nullableArrivalPointSchema = z.string().trim().max(120).nullable().optional();
const interestsFieldSchema = z.array(tripInterestSchema).max(TRIP_INTEREST_VALUES.length);
const destinationPreferencesSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(30);

function tripDateRefinements<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine((v: z.infer<T>) => !(v.endDate && !v.startDate), {
      message: "Add a start date before the end date",
      path: ["startDate"],
    })
    .refine(
      (v: z.infer<T>) => !(v.startDate && v.endDate) || v.endDate >= v.startDate,
      { message: "The end date must be on or after the start date", path: ["endDate"] },
    )
    .refine(
      (v: z.infer<T>) =>
        !(v.startDate && v.endDate) || daysInclusive(v.startDate, v.endDate) <= MAX_TRIP_DAYS,
      { message: `Trips can span at most ${MAX_TRIP_DAYS} days`, path: ["endDate"] },
    );
}

export const tripCreateSchema = tripDateRefinements(
  z.object({
    name: tripNameSchema,
    startDate: nullableDateSchema,
    endDate: nullableDateSchema,
    adults: z.number().int().min(1).max(30).default(1),
    children: z.number().int().min(0).max(20).default(0),
    budgetMinor: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
    currencyCode: currencyCodeSchema.default("GHS"),
    notes: nullableNotesSchema,
    // Wizard preferences (D18) — all optional with server-safe defaults.
    interests: interestsFieldSchema.default([]),
    travelPace: travelPaceSchema.default("BALANCED"),
    budgetTier: budgetTierSchema.default("FLEXIBLE"),
    budgetType: budgetTypeSchema.default("PER_GROUP"),
    budgetIncludesFlights: z.boolean().default(false),
    arrivalPoint: nullableArrivalPointSchema,
    destinationPreferences: destinationPreferencesSchema.default([]),
  }),
);

export const tripUpdateSchema = z
  .object({
    name: tripNameSchema.optional(),
    startDate: nullableDateSchema,
    endDate: nullableDateSchema,
    adults: z.number().int().min(1).max(30).optional(),
    children: z.number().int().min(0).max(20).optional(),
    budgetMinor: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
    currencyCode: currencyCodeSchema.optional(),
    notes: nullableNotesSchema,
    interests: interestsFieldSchema.optional(),
    travelPace: travelPaceSchema.optional(),
    budgetTier: budgetTierSchema.optional(),
    budgetType: budgetTypeSchema.optional(),
    budgetIncludesFlights: z.boolean().optional(),
    arrivalPoint: nullableArrivalPointSchema,
    destinationPreferences: destinationPreferencesSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes provided" });

export type TripCreateInput = z.infer<typeof tripCreateSchema>;
export type TripUpdateInput = z.infer<typeof tripUpdateSchema>;

// ─── Travelers + needs ────────────────────────────────────────────────────────

export const travelerNeedInputSchema = z.object({
  category: needCategorySchema,
  details: z.string().trim().max(500).nullable().optional(),
});

export const travelerCreateSchema = z.object({
  name: z.string().trim().max(120).nullable().optional(),
  ageGroup: z.string().trim().max(40).nullable().optional(),
  needs: z.array(travelerNeedInputSchema).max(10).default([]),
});

export const travelerUpdateSchema = z
  .object({
    name: z.string().trim().max(120).nullable().optional(),
    ageGroup: z.string().trim().max(40).nullable().optional(),
    needs: z.array(travelerNeedInputSchema).max(10).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes provided" });

export type TravelerCreateInput = z.infer<typeof travelerCreateSchema>;
export type TravelerUpdateInput = z.infer<typeof travelerUpdateSchema>;
export type TravelerNeedInput = z.infer<typeof travelerNeedInputSchema>;

// ─── Itinerary days ───────────────────────────────────────────────────────────

export const itineraryDayCreateSchema = z.object({
  title: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const itineraryDayUpdateSchema = z
  .object({
    title: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes provided" });

export type ItineraryDayCreateInput = z.infer<typeof itineraryDayCreateSchema>;
export type ItineraryDayUpdateInput = z.infer<typeof itineraryDayUpdateSchema>;

// ─── Itinerary items ──────────────────────────────────────────────────────────

const itemRefSchema = z.string().trim().min(1).max(64).nullable().optional();
const estimatedCostSchema = z.number().int().min(0).max(2_000_000_000).nullable().optional();

const itemFields = {
  title: z.string().trim().min(1, "Give the activity a title").max(120),
  itemType: itineraryItemTypeSchema.default("NOTE"),
  startTime: timeOfDaySchema.nullable().optional(),
  endTime: timeOfDaySchema.nullable().optional(),
  destinationId: itemRefSchema,
  attractionId: itemRefSchema,
  tourId: itemRefSchema,
  experienceId: itemRefSchema,
  packageId: itemRefSchema,
  // Estimates, never confirmed prices (D18). A cost must say how it is
  // charged so budget totals can be computed without guessing.
  estimatedCostMinor: estimatedCostSchema,
  currencyCode: currencyCodeSchema.nullable().optional(),
  pricingBasis: pricingBasisSchema.nullable().optional(),
  estimateSource: estimateSourceSchema.nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
};

function itemRefinements<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine(
      (v: z.infer<T>) => !(v.startTime && v.endTime) || v.endTime >= v.startTime,
      { message: "The end time must be after the start time", path: ["endTime"] },
    )
    .refine((v: z.infer<T>) => v.estimatedCostMinor == null || v.pricingBasis != null, {
      message: "Choose how the estimate is charged (per person, per night, …)",
      path: ["pricingBasis"],
    });
}

export const itineraryItemCreateSchema = itemRefinements(z.object(itemFields));

export const itineraryItemUpdateSchema = itemRefinements(
  z
    .object({
      ...itemFields,
      title: itemFields.title.optional(),
      itemType: itineraryItemTypeSchema.optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "No changes provided" }),
);

export const reorderItemsSchema = z.object({
  itemIds: z.array(z.string().trim().min(1).max(64)).min(1).max(100),
});

/** Move an item to a day (or to the unscheduled list with `dayId: null`). */
export const itineraryItemMoveSchema = z.object({
  dayId: z.string().trim().min(1).max(64).nullable(),
  position: z.number().int().min(0).max(500).optional(),
});

// ─── Route params ─────────────────────────────────────────────────────────────

const tripIdSchema = z.string().trim().min(1).max(64);

export const tripParamsSchema = z.object({ id: tripIdSchema });
export const tripTravelerParamsSchema = z.object({ id: tripIdSchema, travelerId: tripIdSchema });
export const tripDayParamsSchema = z.object({ id: tripIdSchema, dayId: tripIdSchema });
export const tripItemParamsSchema = z.object({ id: tripIdSchema, itemId: tripIdSchema });

/** Random URL-safe share token minted by the API (32 characters). */
export const tripShareTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{16,64}$/, "Unknown share token format");

export const tripShareParamsSchema = z.object({ token: tripShareTokenSchema });

export type TripShareParams = z.infer<typeof tripShareParamsSchema>;

export type TripParams = z.infer<typeof tripParamsSchema>;
export type TripTravelerParams = z.infer<typeof tripTravelerParamsSchema>;
export type TripDayParams = z.infer<typeof tripDayParamsSchema>;
export type TripItemParams = z.infer<typeof tripItemParamsSchema>;

export type ItineraryItemCreateInput = z.infer<typeof itineraryItemCreateSchema>;
export type ItineraryItemUpdateInput = z.infer<typeof itineraryItemUpdateSchema>;
export type ItineraryItemMoveInput = z.infer<typeof itineraryItemMoveSchema>;
export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>;
