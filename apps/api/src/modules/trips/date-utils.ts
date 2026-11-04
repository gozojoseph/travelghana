/**
 * Date-only helpers for the API side of the trip planner.
 *
 * Trip dates are stored at UTC midnight (Africa/Accra is UTC+0 all year) and
 * exposed to clients as `YYYY-MM-DD`. Item times are stored as UTC timestamps
 * combined with their day's date. Never build these from local-time methods —
 * a server in another timezone would shift every trip by a day.
 */

export const DAY_MS = 86_400_000;

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDaysToDate(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

export function daysInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

export function dateOnlyDeltaDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Combines a day's date with an "HH:mm" time into a UTC timestamp. */
export function combineDayAndTime(day: Date, time: string): Date {
  return new Date(`${formatDateOnly(day)}T${time}:00.000Z`);
}
