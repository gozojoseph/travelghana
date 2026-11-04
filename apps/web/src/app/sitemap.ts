import type { MetadataRoute } from "next";

import { fetchDestinations } from "@/lib/destinations";
import { fetchPublishedPackages } from "@/lib/packages";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [list, packages] = await Promise.all([
    fetchDestinations({ pageSize: 48 }),
    fetchPublishedPackages(),
  ]);

  const destinationEntries =
    list?.items.map((d) => ({
      url: `${BASE_URL}/destinations/${d.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })) ?? [];

  const packageEntries =
    packages?.map((pkg) => ({
      url: `${BASE_URL}/packages/${pkg.slug}`,
      lastModified: pkg.publishedAt ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })) ?? [];

  return [
    { url: `${BASE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/explore`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/destinations`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/packages`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/transport`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/gallery`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/guide`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/register`, changeFrequency: "monthly", priority: 0.3 },
    ...destinationEntries,
    ...packageEntries,
  ];
}
