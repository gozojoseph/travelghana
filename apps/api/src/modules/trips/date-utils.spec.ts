import { describe, expect, it } from "vitest";

import {
  addDaysToDate,
  combineDayAndTime,
  dateOnlyDeltaDays,
  daysInclusive,
  formatDateOnly,
  parseDateOnly,
} from "./date-utils";

describe("date-only helpers", () => {
  it("parses and formats UTC-midnight dates without timezone drift", () => {
    const parsed = parseDateOnly("2026-11-06");
    expect(parsed.toISOString()).toBe("2026-11-06T00:00:00.000Z");
    expect(formatDateOnly(parsed)).toBe("2026-11-06");
  });

  it("adds days across month and year boundaries", () => {
    expect(formatDateOnly(addDaysToDate(parseDateOnly("2026-11-30"), 1))).toBe("2026-12-01");
    expect(formatDateOnly(addDaysToDate(parseDateOnly("2026-12-31"), 1))).toBe("2027-01-01");
    expect(formatDateOnly(addDaysToDate(parseDateOnly("2027-01-01"), -1))).toBe("2026-12-31");
  });

  it("counts inclusive days", () => {
    expect(daysInclusive(parseDateOnly("2026-11-06"), parseDateOnly("2026-11-06"))).toBe(1);
    expect(daysInclusive(parseDateOnly("2026-11-06"), parseDateOnly("2026-11-08"))).toBe(3);
  });

  it("computes signed whole-day deltas", () => {
    expect(dateOnlyDeltaDays(parseDateOnly("2026-11-06"), parseDateOnly("2026-11-09"))).toBe(3);
    expect(dateOnlyDeltaDays(parseDateOnly("2026-11-09"), parseDateOnly("2026-11-06"))).toBe(-3);
    expect(dateOnlyDeltaDays(parseDateOnly("2026-11-06"), parseDateOnly("2026-11-06"))).toBe(0);
  });

  it("combines a day and an HH:mm time into a UTC timestamp", () => {
    expect(combineDayAndTime(parseDateOnly("2026-11-06"), "09:30").toISOString()).toBe(
      "2026-11-06T09:30:00.000Z",
    );
  });
});
