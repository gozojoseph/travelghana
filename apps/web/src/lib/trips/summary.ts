import type {
  ItineraryItem,
  ItineraryItemType,
  PricingBasis,
  TripBudgetLine,
  TripBudgetSummary,
  TripDetail,
  TripPlannerSummary,
  TripSummary,
  TripWarning,
  TravelPace,
} from "@travelghana/types";

/**
 * Demo-mode equivalent of the API's derived planner summary
 * (`apps/api/src/modules/trips/trip-summary.ts`).
 *
 * The API is the source of truth; this mirror exists because the browser-only
 * demo source has no server to compute budgets for it. Rules, messages and
 * thresholds are kept in sync deliberately — change both together.
 */

export type TripSummarySource = Omit<TripDetail, "summary">;

const DAY_MS = 86_400_000;

const PACE_DAY_LIMIT: Record<TravelPace, number> = {
  RELAXED: 3,
  BALANCED: 5,
  PACKED: 7,
};

const PACE_LABELS: Record<TravelPace, string> = {
  RELAXED: "relaxed",
  BALANCED: "balanced",
  PACKED: "packed",
};

function nightsInclusive(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 1;
  const diff = Math.floor(
    (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / DAY_MS,
  );
  return Math.max(1, diff);
}

function minutesOfDay(iso: string): number {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

function allItems(trip: TripSummarySource): ItineraryItem[] {
  return [...trip.days.flatMap((day) => day.items), ...trip.unscheduledItems];
}

function itemTotalMinor(
  item: ItineraryItem,
  tripCurrency: string,
  travelers: number,
  nights: number,
): { total: number | null; unconverted: boolean } {
  if (item.estimatedCostMinor === null) return { total: null, unconverted: false };

  const currency = item.currencyCode ?? tripCurrency;
  if (currency !== tripCurrency) return { total: null, unconverted: true };

  const basis = item.pricingBasis ?? "TOTAL";
  switch (basis) {
    case "PER_PERSON":
      return { total: item.estimatedCostMinor * travelers, unconverted: false };
    case "PER_NIGHT":
      return { total: item.estimatedCostMinor * nights, unconverted: false };
    case "PER_GROUP":
    case "PER_SERVICE":
    case "TOTAL":
    default:
      return { total: item.estimatedCostMinor, unconverted: false };
  }
}

function computeBudget(trip: TripSummarySource): TripBudgetSummary {
  const travelers = Math.max(1, trip.adults + trip.children);
  const nights = nightsInclusive(trip.startDate, trip.endDate);
  const items = allItems(trip);

  const lineTotals = new Map<ItineraryItemType, { estimatedMinor: number; itemCount: number }>();
  let totalEstimatedMinor = 0;
  let pricedItemCount = 0;
  let unpricedItemCount = 0;
  let unconvertedItemCount = 0;

  for (const item of items) {
    const { total, unconverted } = itemTotalMinor(item, trip.currencyCode, travelers, nights);
    if (unconverted) {
      unconvertedItemCount += 1;
      continue;
    }
    if (total === null) {
      unpricedItemCount += 1;
      continue;
    }
    pricedItemCount += 1;
    totalEstimatedMinor += total;
    const line = lineTotals.get(item.itemType) ?? { estimatedMinor: 0, itemCount: 0 };
    line.estimatedMinor += total;
    line.itemCount += 1;
    lineTotals.set(item.itemType, line);
  }

  const lines: TripBudgetLine[] = [...lineTotals.entries()]
    .map(([category, line]) => ({ category, ...line }))
    .sort((a, b) => b.estimatedMinor - a.estimatedMinor);

  const targetMinor =
    trip.budgetMinor === null
      ? null
      : trip.budgetType === "PER_PERSON"
        ? trip.budgetMinor * travelers
        : trip.budgetMinor;
  const remainingMinor = targetMinor === null ? null : targetMinor - totalEstimatedMinor;

  return {
    currencyCode: trip.currencyCode,
    totalEstimatedMinor,
    perPersonEstimatedMinor: Math.round(totalEstimatedMinor / travelers),
    travelers,
    nights,
    targetMinor,
    remainingMinor,
    overBudget: remainingMinor !== null && remainingMinor < 0,
    pricedItemCount,
    unpricedItemCount,
    unconvertedItemCount,
    lines,
  };
}

function computeWarnings(trip: TripSummarySource): TripWarning[] {
  const warnings: TripWarning[] = [];
  const items = allItems(trip);

  if (!trip.startDate) {
    warnings.push({
      code: "TRIP_DATES_MISSING",
      severity: "info",
      message: "Add your travel dates so days and times can be planned.",
    });
  }

  for (const day of trip.days) {
    const timed = day.items.filter((item) => item.startTime !== null);
    const limit = PACE_DAY_LIMIT[trip.travelPace];
    if (timed.length > limit) {
      warnings.push({
        code: "DAY_OVERLOADED",
        severity: "warning",
        message: `Day ${day.dayNumber} has ${timed.length} scheduled activities — more than a ${PACE_LABELS[trip.travelPace]} pace usually fits.`,
        dayId: day.id,
        itemIds: timed.map((item) => item.id),
      });
    }

    const intervals = day.items
      .filter((item) => item.startTime !== null && item.endTime !== null)
      .map((item) => ({
        id: item.id,
        title: item.title,
        start: minutesOfDay(item.startTime as string),
        end: minutesOfDay(item.endTime as string),
      }));

    let overlapsOnDay = 0;
    for (let i = 0; i < intervals.length && overlapsOnDay < 3; i += 1) {
      for (let j = i + 1; j < intervals.length && overlapsOnDay < 3; j += 1) {
        const a = intervals[i];
        const b = intervals[j];
        if (!a || !b) continue;
        if (a.start < b.end && b.start < a.end) {
          overlapsOnDay += 1;
          warnings.push({
            code: "TIME_OVERLAP",
            severity: "warning",
            message: `Day ${day.dayNumber}: "${a.title}" and "${b.title}" overlap in time.`,
            dayId: day.id,
            itemIds: [a.id, b.id],
          });
        }
      }
    }
  }

  if (trip.unscheduledItems.length > 0) {
    warnings.push({
      code: "UNSCHEDULED_ITEMS",
      severity: "info",
      message:
        trip.unscheduledItems.length === 1
          ? "1 idea is not assigned to a day yet."
          : `${trip.unscheduledItems.length} ideas are not assigned to a day yet.`,
    });
  }

  if (trip.days.length >= 2 && !items.some((item) => item.itemType === "ACCOMMODATION")) {
    warnings.push({
      code: "MISSING_ACCOMMODATION",
      severity: "info",
      message: "No sleep plans for the nights yet. Add a Stay on any day, or leave this open.",
    });
  }

  if (trip.days.length >= 2 && !items.some((item) => item.itemType === "TRANSPORT")) {
    warnings.push({
      code: "MISSING_TRANSPORT",
      severity: "info",
      message:
        "No transport or transfers are planned yet — add airport pickup or intercity travel if you need it.",
    });
  }

  const unpriced = items.filter((item) => item.estimatedCostMinor === null).length;
  if (unpriced > 0) {
    warnings.push({
      code: "ITEMS_WITHOUT_PRICE",
      severity: "info",
      message:
        unpriced === 1
          ? "1 activity has no cost estimate yet."
          : `${unpriced} activities have no cost estimate yet.`,
    });
  }

  const unconverted = items.filter(
    (item) =>
      item.estimatedCostMinor !== null &&
      item.currencyCode !== null &&
      item.currencyCode !== trip.currencyCode,
  ).length;
  if (unconverted > 0) {
    warnings.push({
      code: "CURRENCY_NOT_CONVERTED",
      severity: "warning",
      message: `${unconverted === 1 ? "1 estimate uses" : `${unconverted} estimates use`} a different currency and ${unconverted === 1 ? "is" : "are"} not included in the total.`,
    });
  }

  return warnings;
}

export function computeTripSummary(trip: TripSummarySource): TripPlannerSummary {
  const scheduledItemCount = trip.days.reduce((total, day) => total + day.items.length, 0);
  const pricedItemCount = allItems(trip).filter(
    (item) => item.estimatedCostMinor !== null,
  ).length;

  return {
    budget: computeBudget(trip),
    warnings: computeWarnings(trip),
    counts: {
      days: trip.days.length,
      scheduledItemCount,
      unscheduledItemCount: trip.unscheduledItems.length,
      pricedItemCount,
    },
  };
}

/** Attaches a freshly computed summary (mutations must not leave it stale). */
export function withSummary(trip: TripSummarySource): TripDetail {
  return { ...trip, summary: computeTripSummary(trip) };
}

export function toTripSummary(trip: TripSummarySource): TripSummary {
  return {
    id: trip.id,
    name: trip.name,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    adults: trip.adults,
    children: trip.children,
    budgetMinor: trip.budgetMinor,
    currencyCode: trip.currencyCode,
    travelPace: trip.travelPace,
    budgetTier: trip.budgetTier,
    dayCount: trip.days.length,
    travelerCount: trip.travelers.length,
    itemCount:
      trip.days.reduce((total, day) => total + day.items.length, 0) +
      trip.unscheduledItems.length,
    unscheduledItemCount: trip.unscheduledItems.length,
    updatedAt: trip.updatedAt,
  };
}

/** Basis labels used in the budget and item rows. */
export const PRICING_BASIS_LABELS: Record<PricingBasis, string> = {
  PER_PERSON: "per person",
  PER_GROUP: "per group",
  PER_NIGHT: "per night",
  PER_SERVICE: "per service",
  TOTAL: "total",
};
