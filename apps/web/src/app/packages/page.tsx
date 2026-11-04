import type { Metadata } from "next";
import Link from "next/link";
import { Compass, PackageOpen, Route } from "lucide-react";

import { PackageCard } from "@/components/packages/package-card";
import { fetchPublishedPackages } from "@/lib/packages";

export const metadata: Metadata = {
  title: "Created packages · TravelGhana",
  description:
    "Multi-day Ghana journeys created by TravelGhana — heritage, coastline, culture and nature, planned day by day.",
  alternates: { canonical: "/packages" },
};

const primaryClass =
  "inline-flex items-center gap-2 rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]";
const secondaryClass =
  "inline-flex items-center gap-2 rounded-card border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-[0.98]";

export default async function PackagesPage() {
  const packages = await fetchPublishedPackages();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 pb-24">
      <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
        Created by TravelGhana
      </p>
      <div className="animate-rise mt-1 flex flex-wrap items-end justify-between gap-4 [animation-delay:40ms]">
        <div>
          <h1 className="font-display text-4xl md:text-5xl">Packages</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Multi-day journeys put together by TravelGhana — a clear route, a place to stay and
            time to actually experience Ghana.
          </p>
        </div>
        {packages && packages.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {packages.length} {packages.length === 1 ? "journey" : "journeys"} available
          </p>
        ) : null}
      </div>

      {packages === null ? (
        <div className="animate-rise mt-10 rounded-card border border-border bg-card p-8">
          <h2 className="font-display text-2xl">Packages are taking a moment</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            We could not load the catalog right now. Please try again shortly, or keep exploring
            Ghana in the meantime.
          </p>
          <Link href="/explore" className={`${primaryClass} mt-6`}>
            <Compass aria-hidden className="h-4 w-4" /> Explore destinations
          </Link>
        </div>
      ) : null}

      {packages !== null && packages.length === 0 ? (
        <div className="animate-rise mt-10 rounded-card border border-dashed border-border bg-card px-6 py-14">
          <PackageOpen aria-hidden className="h-10 w-10 text-primary/60" />
          <h2 className="mt-4 font-display text-2xl">No packages available yet</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Our journeys are being prepared. In the meantime, explore Ghana or start
            planning your own trip.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/explore" className={primaryClass}>
              <Compass aria-hidden className="h-4 w-4" /> Explore destinations
            </Link>
            <Link href="/plan" className={secondaryClass}>
              <Route aria-hidden className="h-4 w-4" /> Plan your own trip
            </Link>
          </div>
        </div>
      ) : null}

      {packages && packages.length > 0 ? (
        <div className="tg-stagger mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
