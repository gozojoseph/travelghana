import { MAX_TRIP_DAYS } from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { addDaysToDate, daysInclusive } from "./date-utils";

export interface DaySeed {
  dayNumber: number;
  date?: Date;
}

/**
 * Day generation rule (D12):
 * - no dates  → one undated day,
 * - start only → one day dated at the start,
 * - start + end → one day per date (inclusive), capped at 30.
 *
 * Shrinking the range never deletes days; that rule lives in the service's
 * sync step, not here.
 */
export function generateDaySeeds(startDate: Date | null, endDate: Date | null): DaySeed[] {
  if (!startDate) return [{ dayNumber: 1 }];
  if (!endDate) return [{ dayNumber: 1, date: startDate }];

  if (endDate < startDate) {
    throw ApiError.badRequest(
      "The end date must be on or after the start date",
      "INVALID_TRIP_DATES",
    );
  }

  const count = daysInclusive(startDate, endDate);
  if (count > MAX_TRIP_DAYS) {
    throw ApiError.badRequest(`Trips can span at most ${MAX_TRIP_DAYS} days`, "TRIP_TOO_LONG");
  }

  return Array.from({ length: count }, (_, index) => ({
    dayNumber: index + 1,
    date: addDaysToDate(startDate, index),
  }));
}
