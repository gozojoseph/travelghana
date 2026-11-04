"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Compass,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import type { TripDestinationOption, TripDetail } from "@travelghana/types";
import { MAX_TRIP_DAYS } from "@travelghana/validation";

import { formatMoney } from "@/lib/format";
import { tripsSource } from "@/lib/trips";
import { formatDateRange } from "@/lib/trips/date";

import { DemoBanner } from "@/components/trips/demo-banner";
import { DiscoverPanel } from "@/components/trips/discover-panel";
import { ItineraryDayCard } from "@/components/trips/itinerary-day";
import { ConciergePanel } from "@/components/trips/concierge-panel";
import { SharePanel } from "@/components/trips/share-panel";
import { SummaryPanel } from "@/components/trips/summary-panel";
import {
  dangerButtonClass,
  secondaryButtonClass,
  TRIP_STATUS_LABELS,
} from "@/components/trips/shared";
import { TravelerPanel } from "@/components/trips/traveler-panel";
import { TripForm } from "@/components/trips/trip-form";
import { UnscheduledTray } from "@/components/trips/unscheduled-tray";

type MobileTab = "discover" | "itinerary" | "summary";

const TABS: Array<{ key: MobileTab; label: string; icon: typeof Compass }> = [
  { key: "discover", label: "Discover", icon: Compass },
  { key: "itinerary", label: "Itinerary", icon: ListChecks },
  { key: "summary", label: "Summary", icon: Wallet },
];

export default function TripWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [destinationOptions, setDestinationOptions] = useState<TripDestinationOption[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [tab, setTab] = useState<MobileTab>("itinerary");
  const [editingDetails, setEditingDetails] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    // Reset the state machine for this fetch cycle from a microtask: the
    // initial render commits exactly as server-rendered, then clears the
    // previous trip before the network round-trip begins.
    void Promise.resolve().then(() => {
      if (active) setState("loading");
    });
    (async () => {
      try {
        const [loadedTrip, options] = await Promise.all([
          tripsSource.get(params.id),
          tripsSource.destinations().catch(() => [] as TripDestinationOption[]),
        ]);
        if (!active) return;
        if (!loadedTrip) {
          setState("missing");
          return;
        }
        setTrip(loadedTrip);
        setDestinationOptions(options);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [params.id, reloadKey]);

  /** Stable identity keeps the discovery fetch effect from re-running. */
  const handleError = useCallback((message: string) => {
    setPageError(message);
  }, []);

  function applyTrip(updated: TripDetail) {
    setTrip(updated);
  }

  async function addDay() {
    if (!trip) return;
    try {
      setTrip(await tripsSource.addDay(trip.id, {}));
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not add a day");
    }
  }

  async function removeTrip() {
    if (!trip) return;
    if (!window.confirm(`Delete "${trip.name}", its itinerary and traveler needs?`)) return;
    try {
      await tripsSource.remove(trip.id);
      router.push("/trips");
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not delete the trip");
    }
  }

  function focusDay(dayId: string) {
    setTab("itinerary");
    window.setTimeout(() => {
      document.getElementById(`day-${dayId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6">
      <DemoBanner onReset={() => window.location.reload()} />

      <Link
        href="/trips"
        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to my trips
      </Link>

      {state === "loading" ? (
        <>
          <span role="status" className="sr-only">
            Loading your trip…
          </span>
          <div className="mt-6 flex flex-col gap-4" aria-hidden>
            <div className="h-36 animate-pulse rounded-card border border-border bg-card" />
            <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_330px]">
              <div className="h-96 animate-pulse rounded-card border border-border bg-card" />
              <div className="h-96 animate-pulse rounded-card border border-border bg-card" />
              <div className="h-96 animate-pulse rounded-card border border-border bg-card" />
            </div>
          </div>
        </>
      ) : null}

      {state === "missing" ? (
        <div className="mt-8 rounded-card border border-border bg-card p-6">
          <h1 className="font-display text-3xl">Trip not found</h1>
          <p className="mt-2 text-muted-foreground">
            It may have been deleted, or the link belongs to a different account.
          </p>
          <Link href="/trips" className={`${secondaryButtonClass} mt-4`}>
            Back to my trips
          </Link>
        </div>
      ) : null}

      {state === "error" ? (
        <div className="mt-8 rounded-card border border-border bg-card p-6">
          <h1 className="font-display text-2xl">We couldn&apos;t load this trip</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The planner API may be restarting. Your trip has not been changed.
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className={`${secondaryButtonClass} mt-4`}
          >
            <Loader2 aria-hidden className="mr-1.5 inline h-4 w-4" />
            Try again
          </button>
        </div>
      ) : null}

      {state === "ready" && trip ? (
        <>
          <section className="animate-rise mt-4 rounded-card border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {TRIP_STATUS_LABELS[trip.status]}
                  </span>
                  {trip.summary.warnings.length > 0 ? (
                    <span className="rounded-full bg-secondary/30 px-2.5 py-0.5 text-xs font-medium">
                      {trip.summary.warnings.length} planner{" "}
                      {trip.summary.warnings.length === 1 ? "check" : "checks"}
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
                  {trip.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays aria-hidden className="h-4 w-4" />
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ListChecks aria-hidden className="h-4 w-4" />
                    {trip.days.length} {trip.days.length === 1 ? "day" : "days"} ·{" "}
                    {trip.summary.counts.scheduledItemCount} scheduled
                    {trip.summary.counts.unscheduledItemCount > 0
                      ? ` · ${trip.summary.counts.unscheduledItemCount} idea${
                          trip.summary.counts.unscheduledItemCount === 1 ? "" : "s"
                        }`
                      : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users aria-hidden className="h-4 w-4" />
                    {trip.adults} {trip.adults === 1 ? "adult" : "adults"}
                    {trip.children > 0
                      ? ` · ${trip.children} ${trip.children === 1 ? "child" : "children"}`
                      : ""}
                  </span>
                  {trip.budgetMinor !== null ? (
                    <span className="font-medium text-foreground">
                      Budget {formatMoney(trip.budgetMinor, trip.currencyCode)}
                    </span>
                  ) : null}
                </div>
                {trip.notes ? (
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{trip.notes}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDetails((current) => !current)}
                  className={secondaryButtonClass}
                  aria-expanded={editingDetails}
                >
                  <Pencil aria-hidden className="mr-1.5 inline h-3.5 w-3.5" />
                  {editingDetails ? "Close details" : "Edit details"}
                </button>
                <button type="button" onClick={() => void removeTrip()} className={dangerButtonClass}>
                  <Trash2 aria-hidden className="mr-1.5 inline h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>

            {editingDetails ? (
              <div className="animate-pop mt-6 border-t border-border pt-6">
                <TripForm
                  mode="edit"
                  initial={trip}
                  onSaved={(updated) => {
                    setTrip(updated);
                    setEditingDetails(false);
                  }}
                  onCancel={() => setEditingDetails(false)}
                />
              </div>
            ) : null}
          </section>

          {pageError ? (
            <div
              role="alert"
              className="animate-pop mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <span>{pageError}</span>
              <button
                type="button"
                onClick={() => setPageError(null)}
                className="text-xs font-medium underline underline-offset-4"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          <nav
            aria-label="Workspace sections"
            className="sticky top-0 z-30 -mx-4 mt-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 xl:hidden"
          >
            <div className="flex gap-1">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-pressed={tab === key}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-card px-3 py-2 text-xs font-semibold transition-[color,background-color] duration-150 ${
                    tab === key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </nav>

          <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_330px] xl:items-start">
            <div
              className={`${tab === "discover" ? "block" : "hidden xl:block"} xl:sticky xl:top-4`}
            >
              <DiscoverPanel
                trip={trip}
                destinations={destinationOptions}
                onChange={applyTrip}
                onError={handleError}
              />
            </div>

            <div className={`${tab === "itinerary" ? "block" : "hidden xl:block"} min-w-0`}>
              <UnscheduledTray
                trip={trip}
                destinationOptions={destinationOptions}
                onChange={applyTrip}
                onError={handleError}
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl">Day by day</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Times, notes and estimates you entered. Move activities between days or back to
                    the ideas tray.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void addDay()}
                  disabled={trip.days.length >= MAX_TRIP_DAYS}
                  title={
                    trip.days.length >= MAX_TRIP_DAYS
                      ? `Trips can span at most ${MAX_TRIP_DAYS} days`
                      : "Add another day"
                  }
                  className={secondaryButtonClass}
                >
                  <Plus aria-hidden className="mr-1.5 inline h-4 w-4" />
                  Add day
                </button>
              </div>

              <div className="tg-stagger mt-4 flex flex-col gap-4">
                {trip.days.map((day) => (
                  <ItineraryDayCard
                    key={day.id}
                    tripId={trip.id}
                    day={day}
                    days={trip.days}
                    currencyCode={trip.currencyCode}
                    destinationOptions={destinationOptions}
                    onChange={applyTrip}
                    onError={handleError}
                  />
                ))}
              </div>

              {trip.days.length === 0 ? (
                <div className="mt-4 flex flex-col items-start rounded-card border border-dashed border-border bg-card px-6 py-10">
                  <ListChecks aria-hidden className="h-8 w-8 text-primary/60" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No days yet. Add a day, or set dates in the trip details to generate them.
                  </p>
                </div>
              ) : null}
            </div>

            <div className={`${tab === "summary" ? "block" : "hidden xl:block"} flex flex-col gap-4`}>
              <SummaryPanel
                trip={trip}
                destinationOptions={destinationOptions}
                onFocusDay={focusDay}
              />
              <TravelerPanel trip={trip} onChange={applyTrip} />
              <SharePanel trip={trip} />
              <ConciergePanel trip={trip} />
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
