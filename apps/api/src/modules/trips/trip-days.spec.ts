import { describe, expect, it } from "vitest";

import { parseDateOnly } from "./date-utils";
import { generateDaySeeds } from "./trip-days";

/** Returns the thrown value so tests can assert on ApiError fields. */
function captureError(run: () => unknown): unknown {
  try {
    run();
    return null;
  } catch (error) {
    return error;
  }
}

describe("generateDaySeeds", () => {
  it("returns one undated day when the trip has no dates", () => {
    expect(generateDaySeeds(null, null)).toEqual([{ dayNumber: 1 }]);
  });

  it("dates the single day when only a start date is given", () => {
    expect(generateDaySeeds(parseDateOnly("2026-11-06"), null)).toEqual([
      { dayNumber: 1, date: parseDateOnly("2026-11-06") },
    ]);
  });

  it("generates one day per date, inclusive", () => {
    const seeds = generateDaySeeds(parseDateOnly("2026-11-06"), parseDateOnly("2026-11-08"));
    expect(seeds.map((seed) => [seed.dayNumber, seed.date?.toISOString().slice(0, 10)])).toEqual([
      [1, "2026-11-06"],
      [2, "2026-11-07"],
      [3, "2026-11-08"],
    ]);
  });

  it("accepts a 30-day span", () => {
    expect(
      generateDaySeeds(parseDateOnly("2026-11-01"), parseDateOnly("2026-11-30")),
    ).toHaveLength(30);
  });

  it("rejects spans longer than 30 days with TRIP_TOO_LONG", () => {
    expect(
      captureError(() =>
        generateDaySeeds(parseDateOnly("2026-11-01"), parseDateOnly("2026-12-01")),
      ),
    ).toMatchObject({ code: "TRIP_TOO_LONG", status: 400 });
  });

  it("rejects an end date before the start date", () => {
    expect(
      captureError(() =>
        generateDaySeeds(parseDateOnly("2026-11-10"), parseDateOnly("2026-11-01")),
      ),
    ).toMatchObject({ code: "INVALID_TRIP_DATES", status: 400 });
  });
});
