import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

import { MapView } from "@/components/maps/map-view";
import { DestinationCard } from "@/components/destinations/destination-card";
import { CATEGORY_LABELS, fetchDestinations, type DestinationCategory } from "@/lib/destinations";

export const metadata: Metadata = {
  title: "Explore Ghana",
  description:
    "Explore Ghana's regions, cities, beaches, castles, parks and culture — plan what to see and do.",
  alternates: { canonical: "/explore" },
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as DestinationCategory[];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : undefined;

  const list = await fetchDestinations({ category, pageSize: 24 });
  const destinations = list?.items ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-center gap-3">
        <Compass aria-hidden className="h-8 w-8 text-primary" />
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Explore Ghana</h1>
          <p className="text-sm text-muted-foreground">
            From the castles of Cape Coast to the savannas of Mole — find your Ghana.
          </p>
        </div>
      </header>

      {/* Category filters (§14 — simple now, extensible later) */}
      <nav aria-label="Filter by category" className="mt-6 flex flex-wrap gap-2">
        <FilterChip href="/explore" active={!category}>
          All
        </FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c} href={`/explore?category=${c}`} active={category === c}>
            {CATEGORY_LABELS[c]}
          </FilterChip>
        ))}
      </nav>

      {destinations.length === 0 ? (
        <p className="mt-10 rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
          No destinations to show yet{category ? " in this category" : ""}. The API may still be
          starting — try again shortly.
        </p>
      ) : (
        <>
          <section aria-label="Map of destinations" className="mt-8">
            <MapView
              markers={destinations.map((d) => ({
                lat: d.lat,
                lng: d.lng,
                label: d.name,
                href: `/destinations/${d.slug}`,
              }))}
            />
          </section>
          <section aria-label="Destinations" className="mt-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {destinations.map((d) => (
                <DestinationCard key={d.id} destination={d} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
