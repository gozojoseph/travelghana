/**
 * Trip enquiry domain types (D6 — concierge workflow, Phase 2).
 *
 * An enquiry is the honest handoff from the planner to the concierge team:
 * it captures the trip brief and requester contact details, never a booking.
 * The concierge replies and quotes by email; no automated price is promised.
 */

// Defined here (not in index.ts) so this module owns its contract; index.ts
// re-exports via `export *`.
export type EnquiryStatus = "NEW" | "IN_REVIEW" | "QUOTED" | "CONVERTED" | "CLOSED";

export interface Enquiry {
  id: string;
  /** Human-readable reference shown in emails and the admin queue. */
  code: string;
  name: string;
  email: string;
  phone: string | null;
  /** Set when the enquiry was sent from a trip workspace; admin can open the trip. */
  tripId: string | null;
  startDate: string | null;
  endDate: string | null;
  adults: number;
  children: number;
  /** Destination/region names the requester cares about (snapshot, not FKs). */
  destinations: string[];
  /** Planner interest enum values, displayable with the shared labels. */
  interests: string[];
  /** Coarse stated budget, e.g. "GHS 4,000 per group" — derived from the trip when linked. */
  budgetRange: string | null;
  accommodationPref: string | null;
  transportPref: string | null;
  specialRequests: string | null;
  status: EnquiryStatus;
  assignedAdminId: string | null;
  createdAt: string;
  updatedAt: string;
}
