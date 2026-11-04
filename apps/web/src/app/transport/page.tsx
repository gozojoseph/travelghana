import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Bus, MapPin, Users } from "lucide-react";

import { listTransportListings, type TransportListing } from "@/lib/transport";

export const metadata: Metadata = {
  title: "Transport & rides · TravelGhana",
  description:
    "Airport transfers, intercity rides and driver services across Ghana. Request a quote for your date and party - the team replies with a written price.",
  alternates: { canonical: "/transport" },
};

function duration(minutes: number | null): string | null {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function ListingCard({ item }: { item: TransportListing }) {
  const href = `/transport/${encodeURIComponent(item.provider.slug)}/${encodeURIComponent(item.slug)}`;
  return (
    <Link
      href={href}
      className="tg-stagger group flex flex-col overflow-hidden rounded-card border border-border bg-card transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary"
    >
      <div className="flex h-40 items-center justify-center bg-muted/40 text-muted-foreground">
        {item.heroImageUrl ? (
          // Remote images come from the operator's upload later (D45); a plain
          // <img> keeps this surface free of loader config for now.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.heroImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Bus aria-hidden className="h-10 w-10 opacity-40" />
        )}
      </div>
      <div className="flex grow flex-col p-5">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin aria-hidden className="h-3.5 w-3.5" />
          {item.serviceArea ?? "Ghana"}
          {duration(item.durationMinutes) ? ` · ${duration(item.durationMinutes)}` : ""}
        </p>
        <h2 className="mt-1 font-display text-xl group-hover:text-primary">{item.title}</h2>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        ) : null}
        <p className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users aria-hidden className="h-3.5 w-3.5" /> up to {item.capacity}
          </span>
          {item.provider.verificationStatus === "VERIFIED" ? (
            <span className="flex items-center gap-1 text-primary">
              <BadgeCheck aria-hidden className="h-3.5 w-3.5" /> verified
            </span>
          ) : null}
        </p>
        <p className="mt-4 text-sm font-semibold text-primary">Request a quote</p>
      </div>
    </Link>
  );
}

export default async function TransportPage() {
  const result = await listTransportListings();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 pb-24">
      <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
        Transport &amp; rides
      </p>
      <h1 className="animate-rise mt-1 font-display text-4xl md:text-5xl [animation-delay:40ms]">
        Airport transfers and intercity rides
      </h1>
      <p className="animate-rise mt-2 max-w-2xl text-muted-foreground [animation-delay:80ms]">
        Every service here is booked by quote: pick a listing, send your date and party details,
        and our team writes back with a price. Nothing is charged from this site.
      </p>

      {result === null ? (
        <div className="animate-rise mt-10 rounded-card border border-border bg-card p-8">
          <h2 className="font-display text-2xl">Services are taking a moment</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            We could not load the transport options right now. Please try again shortly.
          </p>
        </div>
      ) : null}

      {result !== null && result.items.length === 0 ? (
        <div className="animate-rise mt-10 rounded-card border border-dashed border-border bg-card px-6 py-14 text-center">
          <Bus aria-hidden className="mx-auto h-10 w-10 text-primary/60" />
          <h2 className="mt-4 font-display text-2xl">No transport options listed yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Driver partners and transport companies are joining the platform - check back soon,
            or send an enquiry and we will plan your transfer with you.
          </p>
          <Link
            href="/enquire"
            className="mt-6 inline-flex items-center gap-2 rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Send an enquiry
          </Link>
        </div>
      ) : null}

      {result !== null && result.items.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <ListingCard key={item.slug} item={item} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
