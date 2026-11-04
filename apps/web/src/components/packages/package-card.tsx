/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CalendarDays, MapPin, PackageOpen, Star } from "lucide-react";
import type { PackageSummary } from "@travelghana/types";

import { formatGhs } from "@/lib/format";

/** Public package card — the whole card opens the journey. */
export function PackageCard({ pkg }: { pkg: PackageSummary }) {
  const destination = pkg.destination
    ? [pkg.destination.name, pkg.destination.regionName].filter(Boolean).join(" · ")
    : "Ghana";

  return (
    <Link
      href={`/packages/${pkg.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-border bg-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-primary"
    >
      <div className="relative h-44 overflow-hidden bg-primary/10">
        {pkg.heroImageUrl ? (
          <img
            src={pkg.heroImageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 via-secondary/20 to-muted">
            <PackageOpen
              aria-hidden
              className="h-12 w-12 text-primary/50 transition-transform duration-500 group-hover:scale-110"
            />
          </div>
        )}

        {pkg.featured ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-[color:var(--tg-text-primary)] shadow-sm">
            <Star aria-hidden className="h-3 w-3 fill-current" /> Featured
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-display text-xl leading-snug transition-colors group-hover:text-primary">
          {pkg.title}
        </h3>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {destination}
        </p>
        {pkg.summary ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{pkg.summary}</p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">From</p>
            <p className="font-semibold text-primary">{formatGhs(pkg.priceMinor)}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays aria-hidden className="h-3.5 w-3.5" />
            {pkg.durationDays} days · {pkg.durationNights} nights
          </span>
        </div>
      </div>
    </Link>
  );
}
