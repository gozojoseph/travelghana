"use client";

import type {
  BudgetTier,
  BudgetType,
  ItineraryItemType,
  NeedCategory,
  PricingBasis,
  TravelPace,
  TripInterest,
  TripStatus,
} from "@travelghana/types";

/** Trip-specific labels; generic form primitives are shared via ui/form. */
export {
  buttonClass,
  dangerButtonClass,
  Field,
  FormFeedback,
  inputClass,
  issueMap,
  secondaryButtonClass,
  type ValidationIssueLike,
} from "@/components/ui/form";

export const ITEM_TYPE_LABELS: Record<ItineraryItemType, string> = {
  ATTRACTION: "Attraction",
  RESTAURANT: "Food & drink",
  EVENT: "Event",
  NOTE: "Note",
  TRANSPORT: "Transport",
  ACCOMMODATION: "Stay",
  TOUR: "Tour",
  EXPERIENCE: "Experience",
};

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  PLANNING: "Planning",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const NEED_CATEGORY_LABELS: Record<NeedCategory, string> = {
  ACCESSIBILITY: "Accessibility",
  MOBILITY: "Mobility",
  DIETARY: "Dietary",
  ALLERGY: "Allergy",
  CHILDREN: "Children",
  SENIOR: "Senior",
  PREGNANCY: "Pregnancy",
  MEDICATION: "Medication",
  ASSISTANCE: "Assistance",
  OTHER: "Other",
};

export const NEED_CATEGORIES = Object.keys(NEED_CATEGORY_LABELS) as NeedCategory[];
export const ITEM_TYPES = Object.keys(ITEM_TYPE_LABELS) as ItineraryItemType[];

/** Wizard preference labels (values come from @travelghana/validation). */
export const TRAVEL_PACE_LABELS: Record<TravelPace, string> = {
  RELAXED: "Relaxed",
  BALANCED: "Balanced",
  PACKED: "Packed",
};

export const TRAVEL_PACE_HINTS: Record<TravelPace, string> = {
  RELAXED: "A few activities a day, with room to slow down.",
  BALANCED: "A comfortable mix of planned time and free time.",
  PACKED: "See as much as possible, with fuller days.",
};

export const BUDGET_TIER_LABELS: Record<BudgetTier, string> = {
  BUDGET: "Budget",
  MIDRANGE: "Mid-range",
  PREMIUM: "Premium",
  FLEXIBLE: "Flexible",
};

export const BUDGET_TIER_HINTS: Record<BudgetTier, string> = {
  BUDGET: "Simple stays and local transport.",
  MIDRANGE: "Comfortable stays and a mix of dining.",
  PREMIUM: "Higher-end stays and private transfers.",
  FLEXIBLE: "Not sure yet — keep options open.",
};

export const BUDGET_TYPE_LABELS: Record<BudgetType, string> = {
  PER_PERSON: "Per person",
  PER_GROUP: "Whole group",
};

export const INTEREST_LABELS: Record<TripInterest, string> = {
  CULTURE_HERITAGE: "Culture & heritage",
  BEACHES_COASTAL: "Beaches & coast",
  NATURE_WILDLIFE: "Nature & wildlife",
  ADVENTURE_HIKING: "Adventure & hiking",
  FOOD_CUISINE: "Food & cuisine",
  FESTIVALS_EVENTS: "Festivals & events",
  ART_CRAFTS_SHOPPING: "Art, crafts & shopping",
  NIGHTLIFE_ENTERTAINMENT: "Nightlife & entertainment",
  RELAXATION_WELLNESS: "Relaxation & wellness",
  FAMILY_FRIENDLY: "Family friendly",
};

export const PRICING_BASIS_LABELS: Record<PricingBasis, string> = {
  PER_PERSON: "per person",
  PER_GROUP: "per group",
  PER_NIGHT: "per night",
  PER_SERVICE: "per service",
  TOTAL: "total",
};
