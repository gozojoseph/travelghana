import { describe, expect, it } from "vitest";

import {
  computeTripSummary,
  type SummaryDayInput,
  type SummaryItemInput,
  type TripSummaryInput,
} from "./trip-summary";

let nextId = 1;

function item(overrides: Partial<SummaryItemInput> = {}): SummaryItemInput {
  const id = `item-${nextId++}`;
  return {
    id,
    title: id,
    itemType: "ATTRACTION",
    startTime: null,
    endTime: null,
    estimatedCostMinor: null,
    currencyCode: null,
    pricingBasis: null,
    ...overrides,
  };
}

function day(dayNumber: number, items: SummaryItemInput[] = []): SummaryDayInput {
  return { id: `day-${dayNumber}`, dayNumber, date: null, items };
}

function input(overrides: Partial<TripSummaryInput> = {}): TripSummaryInput {
  return {
    days: [day(1)],
    unscheduledItems: [],
    adults: 2,
    children: 0,
    currencyCode: "GHS",
    budgetMinor: null,
    budgetType: "PER_GROUP",
    travelPace: "BALANCED",
    startDate: null,
    endDate: null,
    ...overrides,
  };
}

function warningCodes(summary: ReturnType<typeof computeTripSummary>): string[] {
  return summary.warnings.map((warning) => warning.code);
}

describe("computeTripSummary — budget", () => {
  it("sums per-person and per-group estimates and counts unpriced items", () => {
    const summary = computeTripSummary(
      input({
        startDate: "2026-11-06",
        endDate: "2026-11-08",
        adults: 2,
        children: 1,
        days: [
          day(1, [
            item({
              itemType: "ATTRACTION",
              estimatedCostMinor: 5_000,
              pricingBasis: "PER_PERSON",
            }),
            item({
              itemType: "TRANSPORT",
              estimatedCostMinor: 12_000,
              pricingBasis: "PER_GROUP",
            }),
          ]),
          day(2, [item({ title: "Unpriced walk" })]),
        ],
      }),
    );

    // Attraction: 5,000 × 3 travelers; transport: 12,000 once.
    expect(summary.budget.totalEstimatedMinor).toBe(27_000);
    expect(summary.budget.perPersonEstimatedMinor).toBe(9_000);
    expect(summary.budget.pricedItemCount).toBe(2);
    expect(summary.budget.unpricedItemCount).toBe(1);
    expect(summary.budget.travelers).toBe(3);
    expect(summary.budget.nights).toBe(2);
    expect(summary.counts).toEqual({
      days: 2,
      scheduledItemCount: 3,
      unscheduledItemCount: 0,
      pricedItemCount: 2,
    });
  });

  it("multiplies per-night estimates by the trip's nights", () => {
    const summary = computeTripSummary(
      input({
        startDate: "2026-11-06",
        endDate: "2026-11-09",
        days: [
          day(
            1,
            [
              item({
                itemType: "ACCOMMODATION",
                estimatedCostMinor: 40_000,
                pricingBasis: "PER_NIGHT",
              }),
            ],
          ),
        ],
      }),
    );

    expect(summary.budget.nights).toBe(3);
    expect(summary.budget.totalEstimatedMinor).toBe(120_000);
  });

  it("includes unscheduled items in the total", () => {
    const summary = computeTripSummary(
      input({
        unscheduledItems: [
          item({ estimatedCostMinor: 8_000, pricingBasis: "TOTAL" }),
        ],
      }),
    );

    expect(summary.budget.totalEstimatedMinor).toBe(8_000);
    expect(summary.counts.unscheduledItemCount).toBe(1);
    expect(summary.counts.scheduledItemCount).toBe(0);
  });

  it("normalises a per-person budget to a whole-group target", () => {
    const summary = computeTripSummary(
      input({
        adults: 2,
        budgetMinor: 50_000,
        budgetType: "PER_PERSON",
        days: [
          day(
            1,
            [item({ estimatedCostMinor: 70_000, pricingBasis: "PER_GROUP" })],
          ),
        ],
      }),
    );

    expect(summary.budget.targetMinor).toBe(100_000);
    expect(summary.budget.remainingMinor).toBe(30_000);
    expect(summary.budget.overBudget).toBe(false);
  });

  it("flags an over-budget trip", () => {
    const summary = computeTripSummary(
      input({
        budgetMinor: 10_000,
        budgetType: "PER_GROUP",
        days: [
          day(
            1,
            [item({ estimatedCostMinor: 15_000, pricingBasis: "PER_GROUP" })],
          ),
        ],
      }),
    );

    expect(summary.budget.remainingMinor).toBe(-5_000);
    expect(summary.budget.overBudget).toBe(true);
  });

  it("keeps unconverted currencies out of the total", () => {
    const summary = computeTripSummary(
      input({
        days: [
          day(1, [
            item({ estimatedCostMinor: 5_000, currencyCode: "GHS", pricingBasis: "TOTAL" }),
            item({ estimatedCostMinor: 9_000, currencyCode: "USD", pricingBasis: "TOTAL" }),
          ]),
        ],
      }),
    );

    expect(summary.budget.totalEstimatedMinor).toBe(5_000);
    expect(summary.budget.unconvertedItemCount).toBe(1);
    expect(summary.budget.pricedItemCount).toBe(1);
    expect(warningCodes(summary)).toContain("CURRENCY_NOT_CONVERTED");
  });

  it("groups budget lines by item type, largest first", () => {
    const summary = computeTripSummary(
      input({
        days: [
          day(1, [
            item({ itemType: "ATTRACTION", estimatedCostMinor: 2_000, pricingBasis: "TOTAL" }),
            item({ itemType: "TRANSPORT", estimatedCostMinor: 9_000, pricingBasis: "TOTAL" }),
          ]),
        ],
      }),
    );

    expect(summary.budget.lines).toEqual([
      { category: "TRANSPORT", estimatedMinor: 9_000, itemCount: 1 },
      { category: "ATTRACTION", estimatedMinor: 2_000, itemCount: 1 },
    ]);
  });

  it("leaves the target empty when no budget was set", () => {
    const summary = computeTripSummary(input());

    expect(summary.budget.targetMinor).toBeNull();
    expect(summary.budget.remainingMinor).toBeNull();
    expect(summary.budget.overBudget).toBe(false);
  });
});

describe("computeTripSummary — warnings", () => {
  it("asks for dates when the trip has none", () => {
    expect(warningCodes(computeTripSummary(input()))).toContain("TRIP_DATES_MISSING");
  });

  it("reports unscheduled ideas with correct pluralisation", () => {
    const one = computeTripSummary(
      input({ unscheduledItems: [item()] }),
    ).warnings.find((warning) => warning.code === "UNSCHEDULED_ITEMS");
    expect(one?.message).toBe("1 idea is not assigned to a day yet.");

    const two = computeTripSummary(
      input({ unscheduledItems: [item(), item()] }),
    ).warnings.find((warning) => warning.code === "UNSCHEDULED_ITEMS");
    expect(two?.message).toBe("2 ideas are not assigned to a day yet.");
  });

  it("flags a day over the pace threshold and not one at the limit", () => {
    const timed = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        item({ startTime: `2026-11-06T0${index + 1}:00:00.000Z` }),
      );

    const relaxed = computeTripSummary(
      input({ travelPace: "RELAXED", days: [day(1, timed(4))] }),
    );
    expect(warningCodes(relaxed)).toContain("DAY_OVERLOADED");

    const balanced = computeTripSummary(
      input({ travelPace: "BALANCED", days: [day(1, timed(5))] }),
    );
    expect(warningCodes(balanced)).not.toContain("DAY_OVERLOADED");
  });

  it("detects overlapping timed activities only when both ends are known", () => {
    const overlap = computeTripSummary(
      input({
        days: [
          day(1, [
            item({
              title: "Museum",
              startTime: "2026-11-06T09:00:00.000Z",
              endTime: "2026-11-06T11:00:00.000Z",
            }),
            item({
              title: "Lunch",
              startTime: "2026-11-06T10:30:00.000Z",
              endTime: "2026-11-06T12:00:00.000Z",
            }),
          ]),
        ],
      }),
    );
    const warning = overlap.warnings.find((entry) => entry.code === "TIME_OVERLAP");
    expect(warning?.severity).toBe("warning");
    expect(warning?.message).toContain("Museum");
    expect(warning?.message).toContain("Lunch");

    const startOnly = computeTripSummary(
      input({
        days: [
          day(1, [
            item({ startTime: "2026-11-06T09:00:00.000Z" }),
            item({ startTime: "2026-11-06T09:00:00.000Z" }),
          ]),
        ],
      }),
    );
    expect(warningCodes(startOnly)).not.toContain("TIME_OVERLAP");
  });

  it("does not flag overlapping times on separate days", () => {
    const summary = computeTripSummary(
      input({
        days: [
          day(1, [
            item({
              startTime: "2026-11-06T09:00:00.000Z",
              endTime: "2026-11-06T11:00:00.000Z",
            }),
          ]),
          day(2, [
            item({
              startTime: "2026-11-07T09:00:00.000Z",
              endTime: "2026-11-07T11:00:00.000Z",
            }),
          ]),
        ],
      }),
    );

    expect(warningCodes(summary)).not.toContain("TIME_OVERLAP");
  });

  it("warns about missing accommodation on multi-day trips only", () => {
    const multi = computeTripSummary(
      input({ days: [day(1), day(2)] }),
    );
    expect(warningCodes(multi)).toContain("MISSING_ACCOMMODATION");

    const withStay = computeTripSummary(
      input({
        days: [
          day(1, [item({ itemType: "ACCOMMODATION" })]),
          day(2),
        ],
      }),
    );
    expect(warningCodes(withStay)).not.toContain("MISSING_ACCOMMODATION");

    const oneDay = computeTripSummary(input());
    expect(warningCodes(oneDay)).not.toContain("MISSING_ACCOMMODATION");
  });

  it("nudges about missing transport without treating it as an error", () => {
    const summary = computeTripSummary(input({ days: [day(1), day(2)] }));
    const warning = summary.warnings.find((entry) => entry.code === "MISSING_TRANSPORT");
    expect(warning?.severity).toBe("info");
  });

  it("reports unpriced activities", () => {
    const summary = computeTripSummary(
      input({ days: [day(1, [item(), item()])] }),
    );
    const warning = summary.warnings.find(
      (entry) => entry.code === "ITEMS_WITHOUT_PRICE",
    );
    expect(warning?.message).toBe("2 activities have no cost estimate yet.");
  });
});
