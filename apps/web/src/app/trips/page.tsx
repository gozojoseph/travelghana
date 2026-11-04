"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Route } from "lucide-react";
import type { TripSummary } from "@travelghana/types";

import { tripsSource } from "@/lib/trips";
import { DemoBanner } from "@/components/trips/demo-banner";
import { TripCard } from "@/components/trips/trip-card";

export default function TripsPage() {
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    tripsSource
      .list()
      .then((items) => {
        if (active) setTrips(items);
      })
      .catch(() => {
        if (active) {
          setError("Could not load your trips.");
          setTrips([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 pb-24">
      <DemoBanner onReset={() => window.location.reload()} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">My trips</h1>
          <p className="mt-1 text-muted-foreground">
            Build a day-by-day itinerary across Ghana — then connect it to bookings.
          </p>
        </div>
        <Link
          href="/plan-my-trip"
          className="inline-flex items-center gap-2 rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]"
        >
          <Plus aria-hidden className="h-4 w-4" />
          Plan a trip
        </Link>
      </div>

      {trips === null ? (
        <>
          <span role="status" className="sr-only">
            Loading your trips…
          </span>
          <div className="mt-8 grid gap-4 sm:grid-cols-2" aria-hidden>
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="animate-pulse rounded-card border border-border bg-card p-5"
              >
                <div className="h-6 w-2/3 rounded bg-muted" />
                <div className="mt-3 h-4 w-1/2 rounded bg-muted" />
                <div className="mt-4 h-3 w-3/4 rounded bg-muted" />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {error ? <p className="animate-pop mt-10 text-muted-foreground">{error}</p> : null}

      {trips !== null && trips.length === 0 && !error ? (
        <div className="animate-rise mt-10 flex flex-col items-start rounded-card border border-dashed border-border bg-card px-6 py-12">
          <Route aria-hidden className="h-10 w-10 text-primary/60" />
          <h2 className="mt-4 font-display text-2xl">No trips yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Start with a destination and the dates, and we&apos;ll generate the days for you. Add
            attractions, food stops and notes as you go.
          </p>
          <Link
            href="/plan-my-trip"
            className="mt-6 rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]"
          >
            Plan my first trip
          </Link>
        </div>
      ) : null}

      {trips !== null && trips.length > 0 ? (
        <div className="tg-stagger mt-8 grid gap-4 sm:grid-cols-2">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
