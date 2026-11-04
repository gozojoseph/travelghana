import type { GalleryItem } from "@travelghana/types";

/**
 * Server-side data access for the public gallery (§42: SSR where beneficial).
 *
 * Gallery edits appear within the same short ISR window as site settings
 * (perf change D30): the payload is small and the page renders from cache
 * for speed; a freshly published photo shows up at most ~60s later.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function fetchPublishedGallery(): Promise<GalleryItem[] | null> {
  try {
    const res = await fetch(`${API_URL}/gallery`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { items: GalleryItem[] };
    return data.items;
  } catch {
    // API unreachable (e.g. not started yet) — the page degrades gracefully.
    return null;
  }
}
