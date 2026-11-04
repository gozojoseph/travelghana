import type { Metadata } from "next";
import Link from "next/link";
import { Package, MapPin, Search, SearchX, Ticket, Sparkles } from "lucide-react";

import { PackageCard } from "@/components/packages/package-card";
import { DestinationCard } from "@/components/destinations/destination-card";
import { ListingCard } from "@/components/catalog/listing-card";
import type { PackageSummary } from "@travelghana/types";
import { fetchPublishedPackages } from "@/lib/packages";
import { fetchDestinations } from "@/lib/destinations";
import { listTours, listExperiences } from "@/lib/catalog";

/**
 * Site search (D40). One honest surface over the four public catalogs the
 * site already serves: curated packages (filtered here - the packages list
 * endpoint has no q yet), destinations, provider tours and operator
 * experiences (the latter three support q server-side). Everything is
 * published-only because every source is a published-only endpoint.
 */

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q?.trim() ? `Search: ${q.trim()} · TravelGhana` : "Search · TravelGhana",
  };
}

/** Case-insensitive match over the fields worth searching on a package.
 * (The list endpoint serves compact summaries, so description is not part
 * of the haystack - title, summary and destination cover it.) */
function packageMatches(pkg: PackageSummary, needle: string): boolean {
  const haystacks = [
    pkg.title,
    pkg.summary ?? "",
    pkg.destination?.name ?? "",
    pkg.destination?.cityName ?? "",
  ];
  return haystacks.some((value) => value.toLowerCase().includes(needle));
}

function SectionHeading({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof Package;
  title: string;
  count: number;
}) {
  return (
    <p className="flex items-center gap-2 font-display text-2xl">
      <Icon aria-hidden className="h-5 w-5 text-primary" />
      {title}
      <span className="text-sm font-sans font-normal text-muted-foreground">
        ({count})
      </span>
    </p>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const { q: raw } = await searchParams;
  const q = raw?.trim() ?? "";
  const needle = q.toLowerCase();

  const [packages, destinations, tours, experiences] = await Promise.all([
    fetchPublishedPackages().then((all) =>
      all ? all.filter((pkg) => needle === "" || packageMatches(pkg, needle)).slice(0, 8) : [],
    ),
    needle === "" ? [] : ((await fetchDestinations({ q, pageSize: 8 }))?.items ?? []),
    needle === "" ? [] : ((await listTours({ q, pageSize: 8 }))?.items ?? []),
    needle === "" ? [] : ((await listExperiences({ q, pageSize: 8 }))?.items ?? []),
  ]);

  // Only sections that exist count as results, so a no-match query can show
  // one truthful empty state.
  const sections = [
    { key: "packages", icon: Package, title: "Journeys", items: packages },
    { key: "destinations", icon: MapPin, title: "Destinations", items: destinations },
    { key: "tours", icon: Ticket, title: "Tours", items: tours },
    { key: "experiences", icon: Sparkles, title: "Experiences", items: experiences },
  ].filter((section) => section.items.length > 0);
  const total = packages.length + destinations.length + tours.length + experiences.length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 pb-24">
      <p className="text-sm font-medium uppercase tracking-widest text-secondary">
        Search
      </p>
      <h1 className="mt-1 font-display text-4xl md:text-5xl">Find your Ghana</h1>

      <form action="/search" role="search" className="mt-8 flex max-w-xl gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Packages, destinations, tours…"
            aria-label="Search TravelGhana"
            className="h-12 w-full rounded-card border border-border bg-background pl-9 pr-3 text-sm outline-none transition-[border-color] duration-150 placeholder:text-muted-foreground focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="rounded-card bg-primary px-5 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]"
        >
          Search
        </button>
      </form>

      {q === "" ? (
        <p className="mt-10 max-w-xl text-sm text-muted-foreground">
          Type above to search our curated journeys, destinations and the published
          tours and experiences of verified operators.
        </p>
      ) : null}

      {q !== "" ? (
        <p className="mt-6 text-sm text-muted-foreground" role="status">
          {total > 0
            ? `${total} ${total === 1 ? "result" : "results"} for "${q}"`
            : null}
        </p>
      ) : null}

      {q !== "" && total === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-card p-10 text-center">
          <SearchX aria-hidden className="h-8 w-8 text-primary" />
          <p className="font-medium">Nothing matched &quot;{q}&quot;</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Try a shorter word, a place name, or browse everything on the{" "}
            <Link href="/packages" className="font-medium text-primary hover:underline">
              journeys
            </Link>{" "}
            and{" "}
            <Link href="/destinations" className="font-medium text-primary hover:underline">
              destinations
            </Link>{" "}
            pages.
          </p>
        </div>
      ) : null}

      <div className="mt-10 flex flex-col gap-12">
        {sections.map((section) => (
          <section key={section.key} aria-label={section.title}>
            <SectionHeading icon={section.icon} title={section.title} count={section.items.length} />
            {section.key === "packages" ? (
              <div className="tg-stagger mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {packages.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} />
                ))}
              </div>
            ) : null}
            {section.key === "destinations" ? (
              <div className="tg-stagger mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {destinations.map((destination) => (
                  <DestinationCard key={destination.id} destination={destination} />
                ))}
              </div>
            ) : null}
            {section.key === "tours" ? (
              <div className="tg-stagger mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tours.map((tour) => (
                  <ListingCard key={tour.id} listing={{ ...tour, kind: "tour" }} />
                ))}
              </div>
            ) : null}
            {section.key === "experiences" ? (
              <div className="tg-stagger mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {experiences.map((experience) => (
                  <ListingCard
                    key={experience.id}
                    listing={{ ...experience, kind: "experience" }}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </main>
  );
}
