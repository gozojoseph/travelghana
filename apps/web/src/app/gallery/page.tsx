import type { Metadata } from "next";
import Link from "next/link";
import { Compass, ImageOff, Images, Route } from "lucide-react";

import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { fetchPublishedGallery } from "@/lib/gallery";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "A visual journey through Ghana — people, places, colour and coastline, created by TravelGhana.",
  alternates: { canonical: "/gallery" },
};

const primaryClass =
  "inline-flex items-center gap-2 rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]";
const secondaryClass =
  "inline-flex items-center gap-2 rounded-card border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-[0.98]";

export default async function GalleryPage() {
  const items = await fetchPublishedGallery();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 pb-24">
      <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
        In pictures
      </p>
      <div className="animate-rise mt-1 flex flex-wrap items-end justify-between gap-4 [animation-delay:40ms]">
        <div>
          <h1 className="font-display text-4xl md:text-5xl">Gallery</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            A visual journey through Ghana, created by TravelGhana — the coast, the cities, the
            craft and the quiet moments in between.
          </p>
        </div>
        {items && items.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "photo" : "photos"}
          </p>
        ) : null}
      </div>

      {items === null ? (
        <div className="animate-rise mt-10 rounded-card border border-border bg-card p-8">
          <h2 className="font-display text-2xl">The gallery is taking a moment</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            We could not load the gallery right now. Please try again shortly, or keep exploring
            Ghana in the meantime.
          </p>
          <Link href="/explore" className={`${primaryClass} mt-6`}>
            <Compass aria-hidden className="h-4 w-4" /> Explore destinations
          </Link>
        </div>
      ) : null}

      {items !== null && items.length === 0 ? (
        <div className="animate-rise mt-10 rounded-card border border-dashed border-border bg-card px-6 py-14">
          <ImageOff aria-hidden className="h-10 w-10 text-primary/60" />
          <h2 className="mt-4 font-display text-2xl">No photos yet</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Our gallery is being created. In the meantime, explore Ghana or start planning your own
            trip.
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

      {items && items.length > 0 ? <GalleryGrid items={items} /> : null}

      {items && items.length > 0 ? (
        <p className="mt-10 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Images aria-hidden className="h-4 w-4 text-primary" />
          New photos are added by the TravelGhana team as we travel.
          <Link
            href="/about"
            className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
          >
            Read our story
          </Link>
        </p>
      ) : null}
    </main>
  );
}
