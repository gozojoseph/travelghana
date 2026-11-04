"use client";

import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Info,
  MapPin,
  Route,
  Users,
} from "lucide-react";
import type {
  TripDestinationOption,
  TripDetail,
  TripWarning,
} from "@travelghana/types";

import { formatMoney } from "@/lib/format";
import { formatDateRange, formatTimeRange } from "@/lib/trips/date";

import { ITEM_ICONS } from "./item-icons";
import {
  BUDGET_TIER_LABELS,
  BUDGET_TYPE_LABELS,
  INTEREST_LABELS,
  ITEM_TYPE_LABELS,
  TRAVEL_PACE_LABELS,
} from "./shared";

function warningIcon(warning: TripWarning) {
  return warning.severity === "warning" ? AlertTriangle : Info;
}

export function SummaryPanel({
  trip,
  destinationOptions,
  onFocusDay,
}: {
  trip: TripDetail;
  destinationOptions: TripDestinationOption[];
  onFocusDay?: (dayId: string) => void;
}) {
  const { budget, warnings, counts } = trip.summary;
  const targetProgress =
    budget.targetMinor !== null && budget.targetMinor > 0
      ? Math.min(100, Math.round((budget.totalEstimatedMinor / budget.targetMinor) * 100))
      : null;

  const preferenceNames = trip.destinationPreferences
    .map((id) => destinationOptions.find((option) => option.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby="summary-heading" className="rounded-card border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="summary-heading" className="font-display text-lg">
            Summary
          </h2>
          <span className="text-[11px] uppercase tracking-widest text-secondary">Estimates</span>
        </div>

        <div className="mt-3 rounded-card bg-primary/5 px-3 py-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CircleDollarSign aria-hidden className="h-3.5 w-3.5" />
            Estimated trip total
          </p>
          <p className="mt-0.5 font-display text-2xl">
            {formatMoney(budget.totalEstimatedMinor, budget.currencyCode)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatMoney(budget.perPersonEstimatedMinor, budget.currencyCode)} per person ·{" "}
            {budget.travelers} {budget.travelers === 1 ? "traveler" : "travelers"} ·{" "}
            {budget.nights} {budget.nights === 1 ? "night" : "nights"}
          </p>
        </div>

        {budget.targetMinor !== null ? (
          <div className="mt-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                Budget ({BUDGET_TYPE_LABELS[trip.budgetType].toLowerCase()})
              </span>
              <span className="font-medium">
                {formatMoney(budget.targetMinor, budget.currencyCode)}
              </span>
            </div>
            {targetProgress !== null ? (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className={`h-full rounded-full ${budget.overBudget ? "bg-accent" : "bg-primary"}`}
                  style={{ width: `${targetProgress}%` }}
                />
              </div>
            ) : null}
            <p
              className={`mt-1.5 font-medium ${
                budget.overBudget ? "text-accent" : "text-primary"
              }`}
            >
              {budget.overBudget
                ? `${formatMoney(Math.abs(budget.remainingMinor ?? 0), budget.currencyCode)} over your budget`
                : `${formatMoney(budget.remainingMinor ?? 0, budget.currencyCode)} left in your budget`}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            No budget set. Add one in the trip details to see how estimates compare.
          </p>
        )}

        {budget.lines.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
            {budget.lines.map((line) => (
              <li key={line.category} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {ITEM_TYPE_LABELS[line.category]}{" "}
                  <span className="text-[10px]">×{line.itemCount}</span>
                </span>
                <span className="font-medium">
                  {formatMoney(line.estimatedMinor, budget.currencyCode)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Add a cost estimate to any activity to see the breakdown.
          </p>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground">
          {budget.pricedItemCount} of{" "}
          {counts.scheduledItemCount + counts.unscheduledItemCount} items have an estimate.
          {budget.unconvertedItemCount > 0
            ? ` ${budget.unconvertedItemCount} in another currency excluded (no FX conversion).`
            : ""}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Estimates are not confirmed prices, taxes or availability.
        </p>
      </section>

      <section aria-labelledby="warnings-heading" className="rounded-card border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="warnings-heading" className="font-display text-lg">
            Planner checks
          </h2>
          <span className="text-[11px] text-muted-foreground">{warnings.length}</span>
        </div>
        {warnings.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Nothing to flag right now. Checks update as you plan.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {warnings.map((warning, index) => {
              const Icon = warningIcon(warning);
              return (
                <li key={`${warning.code}-${warning.dayId ?? index}`} className="flex items-start gap-2 text-xs">
                  <Icon
                    aria-hidden
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      warning.severity === "warning" ? "text-accent" : "text-secondary"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-muted-foreground">{warning.message}</p>
                    {warning.dayId && onFocusDay ? (
                      <button
                        type="button"
                        onClick={() => onFocusDay(warning.dayId as string)}
                        className="mt-0.5 text-[11px] font-medium text-primary underline-offset-4 hover:underline"
                      >
                        View the day
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Pace and overlap checks are heuristics over the times you entered — not opening hours or
          travel times.
        </p>
      </section>

      <section aria-labelledby="brief-heading" className="rounded-card border border-border bg-card p-4">
        <h2 id="brief-heading" className="font-display text-lg">
          Trip brief
        </h2>
        <dl className="mt-2 flex flex-col gap-2 text-xs">
          <div className="flex items-start gap-2">
            <CalendarDays aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div>
              <dt className="sr-only">Dates</dt>
              <dd>{formatDateRange(trip.startDate, trip.endDate)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Users aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div>
              <dt className="sr-only">Travelers</dt>
              <dd>
                {trip.adults} {trip.adults === 1 ? "adult" : "adults"}
                {trip.children > 0
                  ? ` · ${trip.children} ${trip.children === 1 ? "child" : "children"}`
                  : ""}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Route aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div>
              <dt className="sr-only">Travel style</dt>
              <dd>
                {TRAVEL_PACE_LABELS[trip.travelPace]} pace · {BUDGET_TIER_LABELS[trip.budgetTier]}{" "}
                budget · {trip.budgetIncludesFlights ? "flights included" : "flights excluded"}
              </dd>
            </div>
          </div>
          {trip.arrivalPoint ? (
            <div className="flex items-start gap-2">
              <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-muted-foreground">Arrival</dt>
                <dd>{trip.arrivalPoint}</dd>
              </div>
            </div>
          ) : null}
          {trip.interests.length > 0 ? (
            <div>
              <dt className="text-muted-foreground">Interests</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {trip.interests.map((interest) => (
                  <span
                    key={interest}
                    className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {INTEREST_LABELS[interest]}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          {preferenceNames.length > 0 ? (
            <div>
              <dt className="text-muted-foreground">Preferred places</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {preferenceNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {name}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="stops-heading" className="rounded-card border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="stops-heading" className="font-display text-lg">
            Stops
          </h2>
          <span className="text-[11px] text-muted-foreground">
            {counts.scheduledItemCount} scheduled
          </span>
        </div>

        {counts.scheduledItemCount === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Scheduled activities will be listed here in day and time order.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {trip.days.flatMap((day) =>
              day.items.map((item) => {
                const Icon = ITEM_ICONS[item.itemType];
                const place =
                  item.destination?.name ??
                  item.attraction?.name ??
                  item.tour?.title ??
                  item.experience?.title ??
                  item.package?.title ??
                  null;
                return (
                  <li key={item.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon aria-hidden className="h-3 w-3" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="text-muted-foreground">Day {day.dayNumber}</span>{" "}
                        {item.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {[formatTimeRange(item.startTime, item.endTime) || "Anytime", place]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </li>
                );
              }),
            )}
          </ol>
        )}

        <p className="mt-3 rounded-card bg-muted/50 px-2.5 py-2 text-[11px] text-muted-foreground">
          The interactive map is not enabled in this release. This ordered list is the reliable
          view of your stops — no routes or travel times are guessed.
        </p>
      </section>
    </div>
  );
}
