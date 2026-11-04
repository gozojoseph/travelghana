/**
 * Date-only + time-of-day helpers for the trip planner.
 *
 * Trips are planned in calendar days (Africa/Accra is UTC+0 all year), so all
 * conversions pin to UTC midnight. Display uses `timeZone: "UTC"` to avoid
 * the classic off-by-one when a date crosses a timezone boundary.
 */

const DAY_MS = 86_400_000;

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  return toDateOnly(new Date(parseDateOnly(value).getTime() + days * DAY_MS));
}

export function daysInclusive(start: string, end: string): number {
  return Math.round((parseDateOnly(end).getTime() - parseDateOnly(start).getTime()) / DAY_MS) + 1;
}

/** "6 Nov 2026" — or a friendly placeholder when the date is not set yet. */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "Date to be decided";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDateOnly(value));
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (start && end) {
    if (start === end) return formatDateOnly(start);
    const s = parseDateOnly(start);
    const e = parseDateOnly(end);
    const sameMonth =
      s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth();
    if (sameMonth) {
      const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" });
      const monthYear = new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      return `${day.format(s)}–${day.format(e)} ${monthYear.format(e)}`;
    }
    return `${formatDateOnly(start)} – ${formatDateOnly(end)}`;
  }
  if (start) return `From ${formatDateOnly(start)}`;
  if (end) return `Until ${formatDateOnly(end)}`;
  return "Dates to be decided";
}

/** "Fri 6 Nov" — day heading in the builder. */
export function formatDayHeading(value: string | null): string {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseDateOnly(value));
}

/** Combines a day's date with an "HH:mm" time into a UTC ISO timestamp. */
export function combineDateAndTime(date: string, time: string): string {
  return `${date}T${time}:00.000Z`;
}

/** Extracts "HH:mm" from a stored ISO timestamp. */
export function timeOfDay(iso: string | null): string {
  return iso ? iso.slice(11, 16) : "";
}

/** Shifts an ISO timestamp by whole days (used when trip dates move). */
export function shiftIsoDate(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

export function formatTimeRange(start: string | null, end: string | null): string {
  if (start && end) return `${timeOfDay(start)}–${timeOfDay(end)}`;
  if (start) return timeOfDay(start);
  if (end) return `Until ${timeOfDay(end)}`;
  return "";
}
