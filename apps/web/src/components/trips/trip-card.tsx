import Link from "next/link";
import { CalendarDays, ListChecks, Users } from "lucide-react";
import type { TripSummary } from "@travelghana/types";

import { formatMoney } from "@/lib/format";
import { formatDateRange } from "@/lib/trips/date";

import { TRIP_STATUS_LABELS } from "./shared";

export function TripCard({ trip }: { trip: TripSummary }) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex flex-col rounded-card border border-border bg-card p-5 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl leading-snug">{trip.name}</h2>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {TRIP_STATUS_LABELS[trip.status]}
        </span>
      </div>

      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays aria-hidden className="h-4 w-4" />
        {formatDateRange(trip.startDate, trip.endDate)}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ListChecks aria-hidden className="h-4 w-4" />
          {trip.dayCount} {trip.dayCount === 1 ? "day" : "days"} · {trip.itemCount}{" "}
          {trip.itemCount === 1 ? "activity" : "activities"}
        </span>
        {trip.travelerCount > 0 ? (
          <span className="flex items-center gap-1.5">
            <Users aria-hidden className="h-4 w-4" />
            {trip.travelerCount} {trip.travelerCount === 1 ? "traveler" : "travelers"}
          </span>
        ) : null}
        {trip.budgetMinor !== null ? (
          <span className="font-medium text-foreground">
            {formatMoney(trip.budgetMinor, trip.currencyCode)}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
