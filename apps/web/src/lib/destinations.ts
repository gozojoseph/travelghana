/**
 * Server-side data access for destinations (§42: SSR where beneficial).
 * These DTOs mirror the API JSON for the explore surface.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export type DestinationCategory =
  | "BEACH"
  | "HISTORICAL"
  | "CULTURAL"
  | "NATURE"
  | "CITY"
  | "FOOD"
  | "ADVENTURE";

export const CATEGORY_LABELS: Record<DestinationCategory, string> = {
  BEACH: "Beaches",
  HISTORICAL: "Heritage & History",
  CULTURAL: "Culture",
  NATURE: "Nature",
  CITY: "City life",
  FOOD: "Food",
  ADVENTURE: "Adventure",
};

export interface DestinationDto {
  id: string;
  slug: string;
  name: string;
  category: DestinationCategory;
  summary: string | null;
  description: string | null;
  lat: number;
  lng: number;
  heroImageUrl: string | null;
  featured: boolean;
  city: {
    slug: string;
    name: string;
    region: { slug: string; name: string };
  };
}

export interface DestinationDetailDto extends DestinationDto {
  attractions: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    lat: number;
    lng: number;
  }>;
}

export interface DestinationListDto {
  items: DestinationDto[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

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

export function fetchDestinations(params: {
  q?: string;
  category?: string;
  region?: string;
  featured?: string;
  page?: number;
  pageSize?: number;
}): Promise<DestinationListDto | null> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.region) search.set("region", params.region);
  if (params.featured) search.set("featured", params.featured);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString();
  return get<DestinationListDto>(`/destinations${qs ? `?${qs}` : ""}`);
}

export function fetchDestinationBySlug(slug: string): Promise<DestinationDetailDto | null> {
  return get<DestinationDetailDto>(`/destinations/${encodeURIComponent(slug)}`);
}

export function fetchRegions(): Promise<
  Array<{ id: string; slug: string; name: string; cities: Array<{ slug: string; name: string }> }>
> {
  return get("/destinations/regions", 3600) as Promise<
    Array<{ id: string; slug: string; name: string; cities: Array<{ slug: string; name: string }> }>
  >;
}
