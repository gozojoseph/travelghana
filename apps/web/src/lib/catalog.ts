/**
 * Server-side data access for the public catalog (§42: SSR where beneficial).
 * Mirrors GET /api/catalog/tours and /api/catalog/experiences.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export interface CatalogProvider {
  name: string;
  slug: string;
  verificationStatus: string;
}

export interface CatalogCity {
  name: string;
  slug: string;
}

export interface TourDto {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  durationHours: number | null;
  days: number | null;
  groupMin: number;
  groupMax: number;
  basePriceMinor: number;
  currencyCode: string;
  meetingPoint: string | null;
  category: string | null;
  published: boolean;
  provider: CatalogProvider;
  city: CatalogCity | null;
}

export interface ExperienceDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationMinutes: number | null;
  priceMinor: number;
  currencyCode: string;
  category: string | null;
  published: boolean;
  provider: CatalogProvider;
  city: CatalogCity | null;
}

export interface CatalogList<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface CatalogQuery {
  q?: string;
  city?: string;
  category?: string;
  page?: number;
  pageSize?: number;
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

export function listTours(query: CatalogQuery = {}): Promise<CatalogList<TourDto> | null> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.city) params.set("city", query.city);
  if (query.category) params.set("category", query.category);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return getJson(`/catalog/tours${qs ? `?${qs}` : ""}`);
}

export function listExperiences(query: CatalogQuery = {}): Promise<CatalogList<ExperienceDto> | null> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.city) params.set("city", query.city);
  if (query.category) params.set("category", query.category);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return getJson(`/catalog/experiences${qs ? `?${qs}` : ""}`);
}

export function getTour(providerSlug: string, tourSlug: string): Promise<TourDto | null> {
  return getJson(`/catalog/tours/${providerSlug}/${tourSlug}`);
}

export function getExperience(
  providerSlug: string,
  experienceSlug: string,
): Promise<ExperienceDto | null> {
  return getJson(`/catalog/experiences/${providerSlug}/${experienceSlug}`);
}
