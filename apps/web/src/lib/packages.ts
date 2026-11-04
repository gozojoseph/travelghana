import type {
  PackageDepartureDto,
  PackageDetail,
  PackageReviewsResult,
  PackageSummary,
} from "@travelghana/types";

/**
 * Server-side data access for the public package catalog (§42: SSR where
 * beneficial). Only PUBLISHED packages are returned by the API.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function get<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // API unreachable (e.g. not started yet) — pages degrade gracefully.
    return null;
  }
}

export async function fetchPublishedPackages(): Promise<PackageSummary[] | null> {
  const data = await get<{ items: PackageSummary[] }>("/packages");
  return data?.items ?? null;
}

export async function fetchPackageBySlug(slug: string): Promise<PackageDetail | null> {
  const data = await get<{ package: PackageDetail }>(
    `/packages/${encodeURIComponent(slug)}`,
  );
  return data?.package ?? null;
}

/** Future departures with seats left (D41) for the booking panel hinting -
 * the panel itself re-fetches client-side so seat counts stay fresh. */
export async function fetchPackageDepartures(slug: string): Promise<PackageDepartureDto[] | null> {
  const data = await get<{ departures: PackageDepartureDto[] }>(
    `/packages/${encodeURIComponent(slug)}/departures`,
  );
  return data?.departures ?? null;
}

/** Approved reviews + the star average (D42). Null when the API is down -
 * the page then simply omits the reviews section. */
export async function fetchPackageReviews(slug: string): Promise<PackageReviewsResult | null> {
  const data = await get<PackageReviewsResult>(
    `/reviews?packageSlug=${encodeURIComponent(slug)}`,
    60,
  );
  return data;
}
