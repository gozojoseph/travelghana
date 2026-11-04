/**
 * Transport listing requests (D43) - a signed-in traveler asks about one
 * published listing owned by a transport provider. Quote-based only: there
 * are no prices, seats or payment fields on this surface; the team's reply
 * is a written quote (emailed and kept on the row).
 */

export interface ListingRequestListingContext {
  id: string;
  slug: string;
  title: string;
  serviceArea: string | null;
  capacity: number;
  durationMinutes: number | null;
  provider: {
    id: string;
    slug: string;
    name: string;
    /** ProviderType value (TRANSPORT_COMPANY / DRIVER_PARTNER on this surface). */
    type: string;
  };
}

/** Traveler-facing shape: their own request with the listing display context. */
export interface ListingRequest {
  id: string;
  code: string;
  listingId: string;
  startDate: string;
  partySize: number;
  notes: string | null;
  status: string;
  quoteNote: string | null;
  quoteAt: string | null;
  createdAt: string;
  listing: ListingRequestListingContext;
}

export interface MyListingRequestsResult {
  items: ListingRequest[];
  total: number;
}

/** Admin queue shape: adds who requested it. */
export interface AdminListingRequest extends ListingRequest {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  decidedAt: string | null;
}

export interface AdminListingRequestsResult {
  items: AdminListingRequest[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
