import type { Metadata } from "next";
import { Search } from "lucide-react";

import { ListingCard } from "@/components/catalog/listing-card";
import { listTours } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Tours in Ghana",
  description: "Browse bookable tours across Ghana, from heritage walks to river cruises.",
  alternates: { canonical: "/tours" },
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function ToursPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const result = await listTours({ q, pageSize: 24 });
  const tours = result?.items ?? [];
  const total = result?.total ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-secondary">Bookable</p>
          <h1 className="mt-1 font-display text-4xl">Tours in Ghana</h1>
          <p className="mt-2 text-muted-foreground">
            {total} tour{total === 1 ? "" : "s"} offered by local operators
            {q ? ` matching “${q}”` : ""}.
          </p>
        </div>
        <form action="/tours" className="flex items-center gap-2">
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search tours…"
              className="w-56 rounded-card border border-border bg-card py-2.5 pl-9 pr-4 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
          <button
            type="submit"
            className="rounded-card bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]"
          >
            Search
          </button>
        </form>
      </header>

      {tours.length === 0 ? (
        <div className="animate-rise mt-12 rounded-card border border-dashed border-border p-12 text-center">
          <p className="font-medium">No tours found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q ? "Try a different search term." : "Operators are adding tours — check back soon."}
          </p>
        </div>
      ) : (
        <div className="tg-stagger mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tours.map((tour) => (
            <ListingCard key={tour.id} listing={{ ...tour, kind: "tour" }} />
          ))}
        </div>
      )}
    </main>
  );
}
