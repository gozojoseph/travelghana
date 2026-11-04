/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Compass, MapPin, Route, Sparkles } from "lucide-react";

import { DestinationCard } from "@/components/destinations/destination-card";
import { GhanaFlag } from "@/components/brand/ghana-flag";
import { Logo } from "@/components/brand/logo";
import { PackageCard } from "@/components/packages/package-card";
import { fetchDestinations } from "@/lib/destinations";
import { fetchPublishedGallery } from "@/lib/gallery";
import { fetchPublishedPackages } from "@/lib/packages";

/**
 * Homepage (§36): instantly communicates what TravelGhana is, with two primary
 * actions and featured destinations. Draft copy — branding NOT final (§12).
 */
export default async function HomePage() {
  const [featured, packages, gallery] = await Promise.all([
    fetchDestinations({ featured: "true", pageSize: 6 }),
    fetchPublishedPackages(),
    fetchPublishedGallery(),
  ]);

  return (
    <main>
      {/* Hero — blue cloud-sky backdrop (public/hero-sky.svg) with a navy
          readability wash so white copy and the CTAs stay legible. */}
      <section className="relative isolate overflow-hidden text-white">
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-[#3f82d8] bg-cover bg-center bg-[url('/hero-sky.svg')]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-r from-[#04204d]/75 via-[#04204d]/35 to-transparent"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-[#04204d]/55 via-transparent to-transparent"
        />
        {/* On phones the copy spans the full width, including the brighter
            cloud bank; a light tint keeps it readable without hiding the sky. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[#04204d]/40 md:hidden" />

        <div className="tg-stagger mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20 md:py-28">
          <Logo className="h-12 w-auto md:h-14" />
          <h1 className="font-display text-4xl leading-tight drop-shadow-[0_2px_18px_rgba(3,18,44,0.45)] md:text-6xl">
            Discover Ghana. Plan your journey.
            <br />
            Experience more.
          </h1>
          <p className="max-w-xl text-lg text-white/90 [text-shadow:0_1px_10px_rgba(3,18,44,0.55)]">
            Everything you need to experience Ghana — destinations, tours, experiences,
            hotels and trusted drivers, in one place.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-card bg-secondary px-6 py-3 font-semibold text-[color:var(--tg-text-primary)] transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.98]"
            >
              <Compass aria-hidden className="h-5 w-5" />
              Explore Ghana
            </Link>
            <Link
              href="/plan"
              className="inline-flex items-center gap-2 rounded-card border border-white/40 bg-white/5 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-[background-color,transform] duration-150 hover:bg-white/15 active:scale-[0.98]"
            >
              <Route aria-hidden className="h-5 w-5" />
              Plan My Trip
            </Link>
          </div>
        </div>
      </section>

      {/* Featured destinations (real data from the API) */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl md:text-3xl">Featured destinations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Castles, rainforests, waterfalls and savannas — handpicked starting points.
            </p>
          </div>
          <a
            href="/explore"
            className="hidden text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline sm:block"
          >
            View all
          </a>
        </div>

        {featured && featured.items.length > 0 ? (
          <div className="tg-stagger mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((d) => (
              <DestinationCard key={d.id} destination={d} />
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
            Destination guides are on their way — explore is coming to life right now.
          </p>
        )}
      </section>

      {/* Created packages (published only; hidden when the catalog is empty) */}
      {packages && packages.length > 0 ? (
        <section className="border-y border-border bg-muted/20">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl md:text-3xl">Created packages</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Multi-day journeys planned end to end — forts and coastline, culture, nature and
                  time to breathe.
                </p>
              </div>
              <Link
                href="/packages"
                className="hidden shrink-0 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline sm:block"
              >
                View all packages
              </Link>
            </div>

            <div className="tg-stagger mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packages.slice(0, 3).map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>

            <Link
              href="/packages"
              className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline sm:hidden"
            >
              View all packages
            </Link>
          </div>
        </section>
      ) : null}

      {/* Gallery teaser (published items only; hidden when empty) */}
      {gallery && gallery.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl md:text-3xl">From the gallery</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                People, places and colour from across Ghana — new photos added as we travel.
              </p>
            </div>
            <Link
              href="/gallery"
              className="hidden shrink-0 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline sm:block"
            >
              View gallery
            </Link>
          </div>

          <div className="tg-stagger mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {gallery.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                href="/gallery"
                className="group relative aspect-square overflow-hidden rounded-card border border-border bg-muted"
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-sm font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {item.title}
                </span>
              </Link>
            ))}
          </div>

          <Link
            href="/gallery"
            className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline sm:hidden"
          >
            View gallery
          </Link>
        </section>
      ) : null}

      {/* About band — keep the story one click away from the homepage. */}
      <section className="border-t border-border bg-muted/20">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2.5 font-display text-2xl">
              <GhanaFlag className="h-5 w-auto rounded-[2px]" />
              TravelGhana, made in Ghana
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Created journeys and practical planning, built by people who know the road.
            </p>
          </div>
          <Link
            href="/about"
            className="inline-flex shrink-0 items-center gap-2 rounded-card border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-[0.98]"
          >
            About us
          </Link>
        </div>
      </section>

      {/* Coming-next services strip */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="tg-stagger grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Sparkles,
              title: "Tours & experiences",
              body: "Cooking, drumming, kente weaving, heritage walks — authentic experiences with vetted providers.",
            },
            {
              icon: MapPin,
              title: "Trusted drivers & transport",
              body: "Airport pickups, full-day drivers and multi-day itineraries — vehicle, driver and service in one booking.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4 rounded-card border border-border bg-card p-6">
              <Icon aria-hidden className="h-7 w-7 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
