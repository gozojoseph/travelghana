import type {
  ItineraryItemType,
  PricingBasis,
  TripBudgetLine,
  TripBudgetSummary,
  TripPlannerSummary,
  TripWarning,
  TravelPace,
} from "@travelghana/types";

/**
 * Derived planner summary (D18): budget estimate + itinerary warnings.
 *
 * Pure functions over plain inputs so the rules are unit-testable without a
 * database. Everything here is computed from real data the traveler entered —
 * no invented opening hours, travel times, taxes or availability. Warnings are
 * explicitly framed as heuristics in their messages.
 */

export interface SummaryItemInput {
  id: string;
  title: string;
  itemType: ItineraryItemType;
  startTime: string | null;
  endTime: string | null;
  estimatedCostMinor: number | null;
  currencyCode: string | null;
  pricingBasis: PricingBasis | null;
}

export interface SummaryDayInput {
  id: string;
  dayNumber: number;
  date: string | null;
  items: SummaryItemInput[];
}

export interface TripSummaryInput {
  days: SummaryDayInput[];
  unscheduledItems: SummaryItemInput[];
  adults: number;
  children: number;
  currencyCode: string;
  /** The budget as entered; interpreted through `budgetType`. */
  budgetMinor: number | null;
  budgetType: "PER_PERSON" | "PER_GROUP";
  travelPace: TravelPace;
  startDate: string | null;
  endDate: string | null;
}

const DAY_MS = 86_400_000;

/** Timed-activities threshold per pace — a documented heuristic, not a rule. */
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

/** Whole-group amount for an item, or null when it has no usable estimate. */
function itemTotalMinor(
  item: SummaryItemInput,
  tripCurrency: string,
  travelers: number,
  nights: number,
): { total: number | null; unconverted: boolean } {
  if (item.estimatedCostMinor === null) return { total: null, unconverted: false };

  const currency = item.currencyCode ?? tripCurrency;
  if (currency !== tripCurrency) return { total: null, unconverted: true };

  // Validation requires a basis whenever a cost is set; null is treated as
  // whole-group for defensive reads of older rows.
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

function computeBudget(input: TripSummaryInput): TripBudgetSummary {
  const travelers = Math.max(1, input.adults + input.children);
  const nights = nightsInclusive(input.startDate, input.endDate);
  const allItems = [
    ...input.days.flatMap((day) => day.items),
    ...input.unscheduledItems,
  ];

  const lineTotals = new Map<ItineraryItemType, { estimatedMinor: number; itemCount: number }>();
  let totalEstimatedMinor = 0;
  let pricedItemCount = 0;
  let unpricedItemCount = 0;
  let unconvertedItemCount = 0;

  for (const item of allItems) {
    const { total, unconverted } = itemTotalMinor(
      item,
      input.currencyCode,
      travelers,
      nights,
    );
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

  // The entered budget is normalised to a whole-group target so the
  // comparison is unambiguous regardless of how it was stated.
  const targetMinor =
    input.budgetMinor === null
      ? null
      : input.budgetType === "PER_PERSON"
        ? input.budgetMinor * travelers
        : input.budgetMinor;
  const remainingMinor = targetMinor === null ? null : targetMinor - totalEstimatedMinor;

  return {
    currencyCode: input.currencyCode,
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

function computeWarnings(input: TripSummaryInput): TripWarning[] {
  const warnings: TripWarning[] = [];
  const allItems = [
    ...input.days.flatMap((day) => day.items),
    ...input.unscheduledItems,
  ];

  if (!input.startDate) {
    warnings.push({
      code: "TRIP_DATES_MISSING",
      severity: "info",
      message: "Add your travel dates so days and times can be planned.",
    });
  }

  for (const day of input.days) {
    const timed = day.items.filter((item) => item.startTime !== null);

    const limit = PACE_DAY_LIMIT[input.travelPace];
    if (timed.length > limit) {
      warnings.push({
        code: "DAY_OVERLOADED",
        severity: "warning",
        message: `Day ${day.dayNumber} has ${timed.length} scheduled activities — more than a ${PACE_LABELS[input.travelPace]} pace usually fits.`,
        dayId: day.id,
        itemIds: timed.map((item) => item.id),
      });
    }

    // Overlap is only checked when both ends exist: a start time alone does
    // not prove how long an activity takes, and guessing durations would
    // invent facts.
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

  if (input.unscheduledItems.length > 0) {
    warnings.push({
      code: "UNSCHEDULED_ITEMS",
      severity: "info",
      message:
        input.unscheduledItems.length === 1
          ? "1 idea is not assigned to a day yet."
          : `${input.unscheduledItems.length} ideas are not assigned to a day yet.`,
    });
  }

  if (
    input.days.length >= 2 &&
    !allItems.some((item) => item.itemType === "ACCOMMODATION")
  ) {
    warnings.push({
      code: "MISSING_ACCOMMODATION",
      severity: "info",
      message: "No sleep plans for the nights yet. Add a Stay on any day, or leave this open.",
    });
  }

  if (
    input.days.length >= 2 &&
    !allItems.some((item) => item.itemType === "TRANSPORT")
  ) {
    warnings.push({
      code: "MISSING_TRANSPORT",
      severity: "info",
      message:
        "No transport or transfers are planned yet — add airport pickup or intercity travel if you need it.",
    });
  }

  const unpriced = allItems.filter((item) => item.estimatedCostMinor === null).length;
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

  const unconverted = allItems.filter(
    (item) =>
      item.estimatedCostMinor !== null &&
      item.currencyCode !== null &&
      item.currencyCode !== input.currencyCode,
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

export function computeTripSummary(input: TripSummaryInput): TripPlannerSummary {
  const scheduledItemCount = input.days.reduce((total, day) => total + day.items.length, 0);
  const pricedItemCount = [
    ...input.days.flatMap((day) => day.items),
    ...input.unscheduledItems,
  ].filter((item) => item.estimatedCostMinor !== null).length;

  return {
    budget: computeBudget(input),
    warnings: computeWarnings(input),
    counts: {
      days: input.days.length,
      scheduledItemCount,
      unscheduledItemCount: input.unscheduledItems.length,
      pricedItemCount,
    },
  };
}
