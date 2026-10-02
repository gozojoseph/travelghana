import Link from "next/link";
import { MapPin } from "lucide-react";

import type { DestinationDto, DestinationCategory } from "@/lib/destinations";
import { CATEGORY_LABELS } from "@/lib/destinations";

/**
 * Destination card (§52) — Discovery-mode component: imagery-ready, compact,
 * links to the SEO destination page.
 */
export function DestinationCard({ destination }: { destination: DestinationDto }) {
  const category = destination.category as DestinationCategory;
  return (
    <Link
      href={`/destinations/${destination.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-border bg-card transition-shadow hover:shadow-md focus-visible:outline-primary"
    >
      <div className="flex h-40 items-center justify-center bg-primary/10">
        {destination.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={destination.heroImageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <MapPin aria-hidden className="h-10 w-10 text-primary/50" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {CATEGORY_LABELS[category] ?? category}
        </span>
        <h3 className="font-display text-lg leading-snug">{destination.name}</h3>
        <p className="text-xs text-muted-foreground">
          {destination.city.name} · {destination.city.region.name}
        </p>
        {destination.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{destination.summary}</p>
        )}
      </div>
    </Link>
  );
}
