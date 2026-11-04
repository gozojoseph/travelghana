/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Bus, Check, MapPin, X } from "lucide-react";

import { getTransportListing } from "@/lib/transport";
import { RequestQuotePanel } from "@/components/transport/request-quote-panel";

interface Props {
  params: Promise<{ providerSlug: string; listingSlug: string }>;
}

function splitLines(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { providerSlug, listingSlug } = await params;
  const listing = await getTransportListing(providerSlug, listingSlug);
  if (!listing) return { title: "Transport service not found - TravelGhana" };

  const description =
    listing.description?.slice(0, 160) ??
    (listing.serviceArea
      ? `Transport service around ${listing.serviceArea} - request a quote for your date and party.`
      : "Transport service - request a quote for your date and party.");

  return {
    title: `${listing.title} - ${listing.provider.name} · TravelGhana`,
    description,
    alternates: {
      canonical: `/transport/${encodeURIComponent(providerSlug)}/${encodeURIComponent(listing.slug)}`,
    },
    openGraph: {
      title: listing.title,
      description,
      type: "article",
      images: listing.heroImageUrl ? [{ url: listing.heroImageUrl, alt: listing.title }] : undefined,
    },
  };
}

export default async function TransportDetailPage({ params }: Props) {
  const { providerSlug, listingSlug } = await params;
  const listing = await getTransportListing(providerSlug, listingSlug);
  if (!listing) notFound();

  const included = splitLines(listing.whatIsIncluded);
  const requirements = splitLines(listing.requirements);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 pb-24">
      <Link
        href="/transport"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> All transport options
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{listing.provider.name}</span>
            {listing.provider.verificationStatus === "VERIFIED" ? (
              <span className="flex items-center gap-1 text-xs text-primary">
                <BadgeCheck aria-hidden className="h-4 w-4" /> Verified
              </span>
            ) : null}
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1">
              <MapPin aria-hidden className="h-3.5 w-3.5" />
              {listing.serviceArea ?? "Ghana"}
            </span>
            {listing.capacity > 1 ? (
              <>
                <span aria-hidden>·</span>
                <span>up to {listing.capacity} travelers</span>
              </>
            ) : null}
          </p>
          <h1 className="mt-2 font-display text-3xl md:text-4xl">{listing.title}</h1>
          {listing.description ? (
            <p className="mt-3 whitespace-pre-line text-muted-foreground">{listing.description}</p>
          ) : null}

          {listing.heroImageUrl ? (
            <img
              src={listing.heroImageUrl}
              alt={listing.title}
              className="mt-6 w-full rounded-card object-cover"
            />
          ) : null}

          {listing.meetingPoint ? (
            <div className="mt-6">
              <h2 className="font-display text-xl">Meeting point</h2>
              <p className="mt-1 text-sm text-muted-foreground">{listing.meetingPoint}</p>
            </div>
          ) : null}
          {listing.address ? (
            <div className="mt-4">
              <h2 className="font-display text-xl">Where it starts</h2>
              <p className="mt-1 text-sm text-muted-foreground">{listing.address}</p>
            </div>
          ) : null}

          {included.length > 0 ? (
            <div className="mt-6">
              <h2 className="font-display text-xl">What is included</h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {included.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm">
                    <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {requirements.length > 0 ? (
            <div className="mt-6">
              <h2 className="font-display text-xl">Good to know</h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {requirements.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm">
                    <X aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8 rounded-card border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-xl">
              <Bus aria-hidden className="h-5 w-5 text-primary" /> How this works
            </h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Send your travel date, party size and pickup details.</li>
              <li>Our team replies with a written quote by email.</li>
              <li>You confirm when happy - payment is arranged directly with the team.</li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              This site never charges you anything and never asks for card details.
            </p>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-border bg-card p-6">
            <RequestQuotePanel
              listingId={listing.id}
              providerSlug={listing.provider.slug}
              listingSlug={listing.slug}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
