import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  EyeOff,
  ListPlus,
  Sparkles,
  Users,
  Waypoints,
} from "lucide-react";
import type { ItineraryItemType, TripInterest, TripShareView } from "@travelghana/types";
import { TRIP_INTEREST_VALUES } from "@travelghana/validation";

import { formatDateOnly, formatDateRange } from "@/lib/trips/date";

import { ITEM_ICONS } from "./item-icons";
import { INTEREST_LABELS, ITEM_TYPE_LABELS, TRAVEL_PACE_LABELS } from "./shared";

/**
 * Sanitized companion view of a shared trip (D19). Server-rendered from the
 * data the API chose to expose: the plan shape only — no prices, no notes,
 * no traveler needs, no editing.
 */
export function ShareTripView({ share }: { share: TripShareView }) {
  const ships: TripInterest[] = TRIP_INTEREST_VALUES.filter((interest) =>
    share.interests.includes(interest),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 pb-24">
      <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
        Shared trip plan
      </p>
      <header className="animate-rise mt-2 [animation-delay:40ms]">
        <h1 className="font-display text-4xl leading-tight md:text-5xl">{share.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays aria-hidden className="h-4 w-4" />
            {formatDateRange(share.startDate, share.endDate)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users aria-hidden className="h-4 w-4" />
            {share.adults} {share.adults === 1 ? "adult" : "adults"}
            {share.children > 0 ? ` · ${share.children} ${share.children === 1 ? "child" : "children"}` : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles aria-hidden className="h-4 w-4" />
            {TRAVEL_PACE_LABELS[share.travelPace]} pace
          </span>
        </div>
        {ships.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {ships.map((interest) => (
              <span
                key={interest}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {INTEREST_LABELS[interest]}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <div
        role="note"
        className="animate-rise mt-6 flex flex-wrap items-center gap-2 rounded-card border border-secondary/60 bg-secondary/15 px-4 py-3 text-sm [animation-delay:80ms]"
      >
        <EyeOff aria-hidden className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          The owner shared this plan with you. Your view deliberately hides their private budget,
          notes and traveler needs. This is a plan — not a booking.
        </p>
      </div>

      {share.days.length === 0 ? (
        <section className="animate-rise mt-8 rounded-card border border-dashed border-border bg-card px-6 py-12 text-center [animation-delay:120ms]">
          <Waypoints aria-hidden className="mx-auto h-10 w-10 text-primary/60" />
          <h2 className="mt-3 font-display text-2xl">No days planned yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            The owner has not added itinerary days to this trip. Check back later — updates show up
            here automatically.
          </p>
        </section>
      ) : (
        <section aria-label="Itinerary" className="animate-rise tg-stagger mt-8 flex flex-col gap-4 [animation-delay:120ms]">
          {share.days.map((day) => (
            <article key={day.dayNumber} className="rounded-card border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl">
                  Day {day.dayNumber}
                  {day.title ? (
                    <span className="ml-2 text-base font-medium text-muted-foreground">
                      {day.title}
                    </span>
                  ) : null}
                </h2>
                {day.date ? (
                  <span className="text-sm text-muted-foreground">{formatDateOnly(day.date)}</span>
                ) : (
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Date not set
                  </span>
                )}
              </div>

              {day.items.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nothing scheduled for this day yet.</p>
              ) : (
                <ol className="mt-3 flex flex-col divide-y divide-border">
                  {day.items.map((item, index) => {
                    const Icon = ITEM_ICONS[item.itemType as ItineraryItemType];
                    return (
                      <li key={`${item.title}-${index}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                          {Icon ? <Icon aria-hidden className="h-3.5 w-3.5" /> : <ListPlus aria-hidden className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-6">
                            {item.title}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {ITEM_TYPE_LABELS[item.itemType as ItineraryItemType]}
                            </span>
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {item.startTime ? (
                              <span className="flex items-center gap-1">
                                <Clock aria-hidden className="h-3 w-3" />
                                {item.startTime}
                                {item.endTime ? `–${item.endTime}` : ""}
                              </span>
                            ) : (
                              <span>Time not set</span>
                            )}
                            {item.placeName ? (
                              <span className="truncate">{item.placeName}</span>
                            ) : null}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </article>
          ))}
        </section>
      )}

      {share.unscheduledTitles.length > 0 ? (
        <section className="animate-rise mt-4 rounded-card border border-border bg-card p-5 [animation-delay:160ms]">
          <h2 className="font-display text-lg">Still on the ideas list</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {share.unscheduledTitles.map((title, index) => (
              <li
                key={`${title}-${index}`}
                className="rounded-card border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground"
              >
                {title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="animate-rise mt-8 rounded-card border border-border bg-card p-6 [animation-delay:200ms]">
        <h2 className="font-display text-2xl">Planning your own Ghana trip?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          TravelGhana&apos;s planner builds a day-by-day trip around your pace, interests and
          budget — free, no account needed to try it.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/plan-my-trip"
            className="inline-flex items-center gap-2 rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]"
          >
            Start planning <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <Link
            href="/enquire"
            className="inline-flex items-center gap-2 rounded-card border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Ask the concierge team
          </Link>
        </div>
      </section>
    </main>
  );
}
