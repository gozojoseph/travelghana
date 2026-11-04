/**
 * Server-side data access for the transport request surface (D43).
 * Mirrors GET /api/catalog/transport and GET /api/catalog/transport/:providerSlug/:listingSlug.
 * Price fields never surface here: transport requests are quote-based.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export interface TransportListingProvider {
  name: string;
  slug: string;
  verificationStatus: string;
  type: string;
}

export interface TransportListing {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  serviceArea: string | null;
  capacity: number;
  durationMinutes: number | null;
  category: string | null;
  heroImageUrl: string | null;
  publishedAt: string | null;
  provider: TransportListingProvider;
}

/** Detail adds the booking-relevant extras the browse cards do not need. */
export interface TransportListingDetail {
  requirements: string | null;
  whatIsIncluded: string | null;
  address: string | null;
  meetingPoint: string | null;
}

export type TransportListingWithDetail = TransportListing & TransportListingDetail;

export interface TransportList {
  items: TransportListing[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function listTransportListings(page = 1): Promise<TransportList | null> {
  return getJson<TransportList>(`/catalog/transport?page=${page}&pageSize=24`);
}

export function getTransportListing(
  providerSlug: string,
  listingSlug: string,
): Promise<TransportListingWithDetail | null> {
  return getJson<TransportListingWithDetail>(
    `/catalog/transport/${encodeURIComponent(providerSlug)}/${encodeURIComponent(listingSlug)}`,
  );
}
