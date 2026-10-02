import { Compass, MapPin, Route, Sparkles } from "lucide-react";

import { DestinationCard } from "@/components/destinations/destination-card";
import { fetchDestinations } from "@/lib/destinations";

/**
 * Homepage (§36): instantly communicates what TravelGhana is, with two primary
 * actions and featured destinations. Draft copy — branding NOT final (§12).
 */
export default async function HomePage() {
  const featured = await fetchDestinations({ featured: "true", pageSize: 6 });

  return (
    <main>
      {/* Hero */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20 md:py-28">
          <p className="text-sm font-medium uppercase tracking-widest text-secondary">
            TravelGhana
          </p>
          <h1 className="font-display text-4xl leading-tight md:text-6xl">
            Discover Ghana. Plan your journey.
            <br />
            Experience more.
          </h1>
          <p className="max-w-xl text-lg text-primary-foreground/85">
            Everything you need to experience Ghana — destinations, tours, experiences,
            hotels and trusted drivers, in one place.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <a
              href="/explore"
              className="inline-flex items-center gap-2 rounded-card bg-secondary px-6 py-3 font-semibold text-[color:var(--tg-text-primary)] transition-[filter] hover:brightness-105"
            >
              <Compass aria-hidden className="h-5 w-5" />
              Explore Ghana
            </a>
            <a
              href="/plan"
              className="inline-flex items-center gap-2 rounded-card border border-primary-foreground/30 px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
            >
              <Route aria-hidden className="h-5 w-5" />
              Plan My Trip
            </a>
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
            className="hidden text-sm font-medium text-primary underline-offset-4 hover:underline sm:block"
          >
            View all
          </a>
        </div>

        {featured && featured.items.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Coming-next services strip */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
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
