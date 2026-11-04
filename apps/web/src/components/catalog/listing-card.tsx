import Link from "next/link";
import { Clock, MapPin, Sparkles, Ticket } from "lucide-react";

import type { ExperienceDto, TourDto } from "@/lib/catalog";
import { formatGhs } from "@/lib/format";

type Listing =
  | (TourDto & { kind: "tour" })
  | (ExperienceDto & { kind: "experience" });

/** Catalog card for a published tour or experience (§52 reuse). */
export function ListingCard({ listing }: { listing: Listing }) {
  const Icon = listing.kind === "tour" ? Ticket : Sparkles;
  const href =
    listing.kind === "tour"
      ? `/tours/${listing.provider.slug}/${listing.slug}`
      : `/experiences/${listing.provider.slug}/${listing.slug}`;
  const price =
    listing.kind === "tour" ? listing.basePriceMinor : listing.priceMinor;
  const duration =
    listing.kind === "tour"
      ? listing.durationHours
        ? `${listing.durationHours}h`
        : listing.days
          ? `${listing.days} day${listing.days > 1 ? "s" : ""}`
          : null
      : listing.durationMinutes
        ? `${listing.durationMinutes} min`
        : null;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-card border border-border bg-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-primary"
    >
      <div className="flex h-36 items-center justify-center bg-secondary/20">
        <Icon
          aria-hidden
          className="h-10 w-10 text-secondary transition-transform duration-300 group-hover:scale-110"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {listing.category ? (
          <span className="w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {listing.category}
          </span>
        ) : null}
        <h3 className="font-display text-lg leading-snug">{listing.title}</h3>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin aria-hidden className="h-3.5 w-3.5" />
          {listing.city ? listing.city.name : "Anywhere in Ghana"} · by {listing.provider.name}
        </p>
        {listing.kind === "tour" && listing.summary ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{listing.summary}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-sm font-semibold text-primary">
            {formatGhs(price)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">per person</span>
          </span>
          {duration ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock aria-hidden className="h-3.5 w-3.5" /> {duration}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
