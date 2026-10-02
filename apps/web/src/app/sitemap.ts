import type { MetadataRoute } from "next";

import { fetchDestinations } from "@/lib/destinations";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const list = await fetchDestinations({ pageSize: 48 });

  const destinationEntries =
    list?.items.map((d) => ({
      url: `${BASE_URL}/destinations/${d.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })) ?? [];

  return [
    { url: `${BASE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/explore`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/destinations`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/register`, changeFrequency: "monthly", priority: 0.3 },
    ...destinationEntries,
  ];
}
