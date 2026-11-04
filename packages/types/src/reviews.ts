/**
 * Package reviews (D42) - traveler-written, booking-verified (the team must
 * have CONFIRMED the booking), and moderated before anything goes public.
 * The legacy Review model stays in its operator domain untouched.
 */
import type { BookingStatus } from "./index";

export type PackageReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

/** What the public sees on a package page: approved reviews only, no emails. */
export interface PublicPackageReviewDto {
  id: string;
  rating: number;
  body: string | null;
  /** Display name of the traveler; "Traveler" when they shared no name. */
  authorName: string;
  createdAt: string;
}

export interface PackageReviewsResult {
  items: PublicPackageReviewDto[];
  summary: {
    /** Rounded to one decimal; null when there are no approved reviews yet. */
    average: number | null;
    /** How many APPROVED reviews the average is based on. */
    count: number;
  };
}

/** Admin-side record with the moderation trail. */
export interface AdminPackageReviewDto {
  id: string;
  rating: number;
  body: string | null;
  status: PackageReviewStatus;
  /** Kept when rejected; the console shows it as the reason. */
  decisionNote: string | null;
  createdAt: string;
  author: { id: string; name: string | null; email: string };
  booking: { id: string; code: string; status: BookingStatus; startDate: string };
  package: { id: string; slug: string; title: string };
}

export interface AdminPackageReviewsResult {
  items: AdminPackageReviewDto[];
  total: number;
}

/** What the traveler-side form asks before rendering: can this member post a
 * review for the package, and did they already (any status). */
export interface ReviewEligibilityDto {
  eligible: boolean;
  existing: { id: string; status: PackageReviewStatus } | null;
}
