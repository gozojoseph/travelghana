/**
 * Curated package domain types (admin-managed, platform-owned).
 *
 * A package is editorial content today: a multi-day Ghana itinerary outline
 * with a headline price. It is not provider inventory and is not bookable yet.
 */

export type PackageStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/** Destination reference shown on admin cards and (later) public pages. */
export interface PackageDestinationRef {
  id: string;
  slug: string;
  name: string;
  cityName: string | null;
  regionName: string | null;
}

/** One editorial day in a package outline. */
export interface PackageDay {
  id: string;
  dayNumber: number;
  title: string;
  description: string | null;
  meals: string | null;
  accommodation: string | null;
}

/** Compact shape for the admin list. */
export interface PackageSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  destination: PackageDestinationRef | null;
  durationDays: number;
  durationNights: number;
  priceMinor: number;
  currencyCode: string;
  heroImageUrl: string | null;
  status: PackageStatus;
  featured: boolean;
  dayCount: number;
  publishedAt: string | null;
  updatedAt: string;
}

/** Full editor shape, including the day-by-day outline. */
export interface PackageDetail extends PackageSummary {
  description: string | null;
  inclusions: string | null;
  exclusions: string | null;
  createdAt: string;
  days: PackageDay[];
}

// ─── Departures (D41) ────────────────────────────────────────────────────────

/** One departure date of a package, with the seats still bookable on it.
 * `remaining` is derived (seats minus live bookings' party size), so it can
 * even be negative on admin lists after backdated corrections. */
export interface PackageDepartureDto {
  id: string;
  /** "YYYY-MM-DD" - the departure date at UTC midnight. */
  date: string;
  seats: number;
  remaining: number;
}

export interface PackageDeparturesResult {
  items: PackageDepartureDto[];
}
