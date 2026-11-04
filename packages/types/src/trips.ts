/**
 * Trip planner domain types (§14 Trip + itinerary builder).
 *
 * These DTO shapes are what the web app consumes (demo source and API source
 * share one contract), so planner components never branch on the data source.
 */

export type TripStatus =
  | "PLANNING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

/** Planner preferences (D18 wizard steps). */
export type TravelPace = "RELAXED" | "BALANCED" | "PACKED";
export type BudgetTier = "BUDGET" | "MIDRANGE" | "PREMIUM" | "FLEXIBLE";
export type BudgetType = "PER_PERSON" | "PER_GROUP";
export type TripInterest =
  | "CULTURE_HERITAGE"
  | "BEACHES_COASTAL"
  | "NATURE_WILDLIFE"
  | "ADVENTURE_HIKING"
  | "FOOD_CUISINE"
  | "FESTIVALS_EVENTS"
  | "ART_CRAFTS_SHOPPING"
  | "NIGHTLIFE_ENTERTAINMENT"
  | "RELAXATION_WELLNESS"
  | "FAMILY_FRIENDLY";

/** Sensitive traveler need categories (§11 — visibility-scoped, consent-gated). */
export type NeedCategory =
  | "ACCESSIBILITY"
  | "MOBILITY"
  | "DIETARY"
  | "ALLERGY"
  | "CHILDREN"
  | "SENIOR"
  | "PREGNANCY"
  | "MEDICATION"
  | "ASSISTANCE"
  | "OTHER";

/**
 * Itinerary item types the planner supports now. `BOOKING` exists in the Prisma
 * enum but stays disabled until the booking engine ships.
 */
export type ItineraryItemType =
  | "ATTRACTION"
  | "RESTAURANT"
  | "EVENT"
  | "NOTE"
  | "TRANSPORT"
  | "ACCOMMODATION"
  | "TOUR"
  | "EXPERIENCE";

/** How an estimate is charged (D18 — estimates are never confirmed prices). */
export type PricingBasis = "PER_PERSON" | "PER_GROUP" | "PER_NIGHT" | "PER_SERVICE" | "TOTAL";

/** Where an estimate came from: a listing snapshot or the traveler's own number. */
export type EstimateSource = "LISTING" | "MANUAL";

/** Destination reference attached to an itinerary item. */
export interface TripDestinationRef {
  id: string;
  slug: string;
  name: string;
  cityName: string | null;
  regionName: string | null;
}

/** A place that can be linked to an itinerary item (picker option). */
export interface TripDestinationOption {
  id: string;
  slug: string;
  name: string;
  cityName: string | null;
  regionName: string | null;
}

/** Attraction reference linked to an itinerary item. */
export interface TripAttractionRef {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  cityName: string | null;
  destination: { slug: string; name: string } | null;
}

/** Published tour reference linked to an itinerary item (price is a snapshot). */
export interface TripTourRef {
  id: string;
  slug: string;
  title: string;
  providerSlug: string;
  providerName: string;
  priceMinor: number;
  currencyCode: string;
  durationHours: number | null;
  days: number | null;
}

/** Published experience reference linked to an itinerary item. */
export interface TripExperienceRef {
  id: string;
  slug: string;
  title: string;
  providerSlug: string;
  providerName: string;
  priceMinor: number;
  currencyCode: string;
  durationMinutes: number | null;
}

/** Curated package reference linked to an itinerary item. */
export interface TripPackageRef {
  id: string;
  slug: string;
  title: string;
  durationDays: number;
  durationNights: number;
  priceMinor: number;
  currencyCode: string;
}

export interface TravelerNeed {
  id: string;
  category: NeedCategory;
  details: string | null;
}

export interface TripTraveler {
  id: string;
  name: string | null;
  ageGroup: string | null;
  needs: TravelerNeed[];
}

export interface ItineraryItem {
  id: string;
  title: string;
  itemType: ItineraryItemType;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  sortOrder: number;
  destination: TripDestinationRef | null;
  attraction: TripAttractionRef | null;
  tour: TripTourRef | null;
  experience: TripExperienceRef | null;
  package: TripPackageRef | null;
  /** Estimate only — never treated as a confirmed or current price. */
  estimatedCostMinor: number | null;
  currencyCode: string | null;
  pricingBasis: PricingBasis | null;
  estimateSource: EstimateSource | null;
  priceSnapshotAt: string | null;
  createdAt: string;
}

export interface ItineraryDay {
  id: string;
  dayNumber: number;
  date: string | null;
  title: string | null;
  notes: string | null;
  items: ItineraryItem[];
}

export interface TripSummary {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  adults: number;
  children: number;
  budgetMinor: number | null;
  currencyCode: string;
  travelPace: TravelPace;
  budgetTier: BudgetTier;
  dayCount: number;
  travelerCount: number;
  itemCount: number;
  unscheduledItemCount: number;
  updatedAt: string;
}

/** Planner warnings (D18) — heuristics over real data only, never invented facts. */
export type TripWarningCode =
  | "TRIP_DATES_MISSING"
  | "UNSCHEDULED_ITEMS"
  | "DAY_OVERLOADED"
  | "TIME_OVERLAP"
  | "MISSING_ACCOMMODATION"
  | "MISSING_TRANSPORT"
  | "ITEMS_WITHOUT_PRICE"
  | "CURRENCY_NOT_CONVERTED";

export interface TripWarning {
  code: TripWarningCode;
  severity: "info" | "warning";
  message: string;
  dayId?: string;
  itemIds?: string[];
}

export interface TripBudgetLine {
  category: ItineraryItemType;
  estimatedMinor: number;
  itemCount: number;
}

/** Derived, never stored — recomputed from the trip graph on every read. */
export interface TripBudgetSummary {
  currencyCode: string;
  totalEstimatedMinor: number;
  perPersonEstimatedMinor: number;
  travelers: number;
  nights: number;
  targetMinor: number | null;
  remainingMinor: number | null;
  overBudget: boolean;
  pricedItemCount: number;
  unpricedItemCount: number;
  unconvertedItemCount: number;
  lines: TripBudgetLine[];
}

export interface TripPlannerSummary {
  budget: TripBudgetSummary;
  warnings: TripWarning[];
  counts: {
    days: number;
    scheduledItemCount: number;
    unscheduledItemCount: number;
    pricedItemCount: number;
  };
}

export interface TripDetail {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  adults: number;
  children: number;
  budgetMinor: number | null;
  currencyCode: string;
  notes: string | null;
  interests: TripInterest[];
  travelPace: TravelPace;
  budgetTier: BudgetTier;
  budgetType: BudgetType;
  budgetIncludesFlights: boolean;
  arrivalPoint: string | null;
  destinationPreferences: string[];
  travelers: TripTraveler[];
  days: ItineraryDay[];
  /** Trip-level ideas that are not yet assigned to a day. */
  unscheduledItems: ItineraryItem[];
  summary: TripPlannerSummary;
  createdAt: string;
  updatedAt: string;
}

// ─── Trip sharing (D19: sanitized companion view) ────────────────────────────

/** One scheduled activity in a shared plan. No costs, no notes, no booking state. */
export interface TripShareItemView {
  title: string;
  itemType: ItineraryItemType;
  /** "HH:mm" or null when the activity is untimed. */
  startTime: string | null;
  endTime: string | null;
  /** Destination/attraction/listing name attached to the item, if any. */
  placeName: string | null;
}

export interface TripShareDayView {
  dayNumber: number;
  /** Date-only string, or null for an undated day. */
  date: string | null;
  title: string | null;
  items: TripShareItemView[];
}

/**
 * What a share link reveals (D19): the shape of the plan — days, times, places
 * and interests — plus the party size. Deliberately excludes budget figures,
 * estimates, item notes, trip notes, planner warnings and every traveler need
 * (§11). The API builds this server-side; a client cannot un-sanitize it.
 */
export interface TripShareView {
  name: string;
  startDate: string | null;
  endDate: string | null;
  adults: number;
  children: number;
  interests: TripInterest[];
  travelPace: TravelPace;
  days: TripShareDayView[];
  /** Titles of not-yet-scheduled ideas ("we might also want to…"). */
  unscheduledTitles: string[];
  generatedAt: string;
}

/** Owner-facing share state for the workspace panel. */
export interface TripShareStatus {
  active: boolean;
  /** Site-relative path ("/share/<token>"), null when no active share exists. */
  path: string | null;
}
