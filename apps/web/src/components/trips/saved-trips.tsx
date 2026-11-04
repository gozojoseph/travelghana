"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, LogIn, Route } from "lucide-react";
import type { TripSummary } from "@travelghana/types";

import { ApiClientError } from "@/lib/api";
import { tripsSource } from "@/lib/trips";

import { TripCard } from "./trip-card";

type SavedState = "loading" | "ready" | "auth" | "error";

/** Saved-trip list on the planner entry page. */
export function SavedTrips() {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [state, setState] = useState<SavedState>("loading");

  useEffect(() => {
    let active = true;
    tripsSource
      .list()
      .then((items) => {
        if (!active) return;
        setTrips(items);
        setState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setState(error instanceof ApiClientError && error.status === 401 ? "auth" : "error");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-labelledby="saved-trips-heading" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="saved-trips-heading" className="font-display text-2xl">
            Your saved trips
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Plans you created with this account. Open one to keep building.
          </p>
        </div>
        <Link
          href="/trips"
          className="inline-flex items-center gap-1.5 rounded-card border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-[0.98]"
        >
          All trips
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>

      {state === "loading" ? (
        <>
          <span role="status" className="sr-only">
            Loading your saved trips…
          </span>
          <div className="mt-5 grid gap-4 sm:grid-cols-2" aria-hidden>
            {[0, 1].map((index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-card border border-border bg-card"
              />
            ))}
          </div>
        </>
      ) : null}

      {state === "auth" ? (
        <div className="mt-5 flex flex-col items-start rounded-card border border-dashed border-border bg-card px-6 py-8">
          <LogIn aria-hidden className="h-8 w-8 text-primary/60" />
          <p className="mt-3 font-medium">Sign in to see your saved trips</p>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Your plans live in your account. You can keep drafting your trip brief above — we&apos;ll
            ask you to sign in when you save it.
          </p>
          <Link
            href="/login?next=%2Fplan-my-trip"
            className="mt-4 rounded-card bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]"
          >
            Log in
          </Link>
        </div>
      ) : null}

      {state === "error" ? (
        <p className="mt-5 rounded-card border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Could not load your saved trips right now. Your drafts above are unaffected.
        </p>
      ) : null}

      {state === "ready" && trips.length === 0 ? (
        <div className="mt-5 flex flex-col items-start rounded-card border border-dashed border-border bg-card px-6 py-8">
          <Route aria-hidden className="h-8 w-8 text-primary/60" />
          <p className="mt-3 font-medium">No trips yet</p>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Finish the trip brief above and create your first plan. We generate a day for every
            date you choose.
          </p>
        </div>
      ) : null}

      {state === "ready" && trips.length > 0 ? (
        <div className="tg-stagger mt-5 grid gap-4 sm:grid-cols-2">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
