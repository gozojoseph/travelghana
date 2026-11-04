"use client";

import Link from "next/link";
import {
  CalendarCheck,
  CircleDollarSign,
  Compass,
  ConciergeBell,
  ListChecks,
  MapPin,
  Sparkles,
} from "lucide-react";

import { DemoBanner } from "./demo-banner";
import { SavedTrips } from "./saved-trips";
import { TripWizard } from "./trip-wizard";

const primaryClass =
  "inline-flex items-center gap-2 rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]";
const secondaryClass =
  "inline-flex items-center gap-2 rounded-card border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-[0.98]";

/** Planner entry: hero, personalized setup wizard and saved trips. */
export function PlanMyTrip() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 pb-24 sm:py-12">
      <DemoBanner onReset={() => window.location.reload()} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0">
          <header className="tg-stagger">
            <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-secondary">
              <Sparkles aria-hidden className="h-4 w-4" />
              Your trip, your pace
            </p>
            <h1 className="mt-2 max-w-3xl font-display text-4xl leading-tight md:text-5xl">
              Plan a Ghana trip that fits you
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Tell us who&apos;s travelling and how you like to travel. Then build a day-by-day
              itinerary from real places and published listings — with honest estimates, not
              invented prices.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#planner" className={primaryClass}>
                <CalendarCheck aria-hidden className="h-4 w-4" />
                Start your trip brief
              </a>
              <Link href="/explore" className={secondaryClass}>
                <Compass aria-hidden className="h-4 w-4" />
                Explore places first
              </Link>
            </div>
          </header>

          <div id="planner" className="mt-10 scroll-mt-24">
            <TripWizard />
          </div>

          <SavedTrips />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-8">
          <section className="rounded-card border border-border bg-card p-5">
            <h2 className="font-display text-lg">What you can do</h2>
            <ul className="mt-3 flex flex-col gap-3 text-sm">
              <li className="flex items-start gap-2.5">
                <ListChecks aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Build a day-by-day itinerary with times, notes and flexible ideas.
              </li>
              <li className="flex items-start gap-2.5">
                <CircleDollarSign aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                See an estimated budget by category, including what still has no price.
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Keep stops ordered and readable now — the interactive map is not enabled yet.
              </li>
            </ul>
          </section>

          <section className="rounded-card border border-secondary/60 bg-secondary/15 p-5 text-sm">
            <h2 className="font-display text-lg">Honest by design</h2>
            <p className="mt-2 text-muted-foreground">
              Prices you see are estimates or snapshots from published listings. This planner does
              not take payments, reserve inventory or confirm bookings in this release.
            </p>
            <p className="mt-3 text-muted-foreground">
              Opening hours, travel times, ratings and availability are not invented. If we
              don&apos;t have the data, we say so.
            </p>
          </section>

          <section className="rounded-card border border-border bg-card p-5 text-sm">
            <h2 className="font-display text-lg">Private by default</h2>
            <p className="mt-2 text-muted-foreground">
              Traveler names and sensitive needs are visible only to you on your trip. Share links,
              when you create one, show a sanitized outline: no prices, no notes, no needs.
            </p>
          </section>

          <section className="rounded-card border border-border bg-card p-5 text-sm">
            <h2 className="flex items-center gap-2 font-display text-lg">
              <ConciergeBell aria-hidden className="h-4 w-4 text-primary" />
              Prefer a person?
            </h2>
            <p className="mt-2 text-muted-foreground">
              Our concierge team plans custom trips with you and quotes by email. Ask them anything
              — no account needed.
            </p>
            <Link
              href="/enquire"
              className="mt-3 inline-flex items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline"
            >
              Ask the concierge team
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
