"use client";

import { useState } from "react";
import { CalendarPlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type {
  ItineraryItem,
  TripDestinationOption,
  TripDetail,
} from "@travelghana/types";

import { formatMoney } from "@/lib/format";
import { tripsSource } from "@/lib/trips";

import { ItineraryItemForm } from "./itinerary-item-form";
import { ITEM_ICONS } from "./item-icons";
import {
  ITEM_TYPE_LABELS,
  PRICING_BASIS_LABELS,
  secondaryButtonClass,
} from "./shared";

interface UnscheduledTrayProps {
  trip: TripDetail;
  destinationOptions: TripDestinationOption[];
  onChange: (trip: TripDetail) => void;
  onError: (message: string) => void;
}

/**
 * Ideas the traveler saved without assigning a day. Times are intentionally
 * absent here: a clock time only means something once a day (and date) exists.
 */
export function UnscheduledTray({
  trip,
  destinationOptions,
  onChange,
  onError,
}: UnscheduledTrayProps) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ItineraryItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function schedule(itemId: string, dayId: string) {
    setPendingId(itemId);
    try {
      onChange(await tripsSource.moveItem(trip.id, itemId, dayId));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not schedule the idea");
    } finally {
      setPendingId(null);
    }
  }

  async function reorder(itemId: string, direction: -1 | 1) {
    const ids = trip.unscheduledItems.map((item) => item.id);
    const index = ids.indexOf(itemId);
    const target = index + direction;
    const first = ids[index];
    const second = ids[target];
    if (index < 0 || target < 0 || target >= ids.length || !first || !second) return;
    ids[index] = second;
    ids[target] = first;
    try {
      onChange(await tripsSource.reorderUnscheduledItems(trip.id, ids));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not reorder the ideas");
    }
  }

  async function remove(item: ItineraryItem) {
    if (!window.confirm(`Remove "${item.title}" from your ideas?`)) return;
    try {
      onChange(await tripsSource.removeItem(trip.id, item.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not remove the idea");
    }
  }

  return (
    <section
      aria-labelledby="unscheduled-heading"
      className="rounded-card border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="unscheduled-heading" className="font-display text-lg">
            Ideas to place
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved ideas without a day. Schedule one when you know where it fits.
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {trip.unscheduledItems.length}
        </span>
      </div>

      {trip.unscheduledItems.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No unscheduled ideas. Add one from Discover, or create a note below.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {trip.unscheduledItems.map((item, index) => {
            const Icon = ITEM_ICONS[item.itemType];
            const estimate =
              item.estimatedCostMinor !== null
                ? `${formatMoney(
                    item.estimatedCostMinor,
                    item.currencyCode ?? trip.currencyCode,
                  )}${item.pricingBasis ? ` ${PRICING_BASIS_LABELS[item.pricingBasis]}` : ""}`
                : null;
            const place =
              item.destination?.name ??
              item.attraction?.name ??
              item.tour?.title ??
              item.experience?.title ??
              item.package?.title ??
              null;

            return (
              <li key={item.id} className="rounded-card border border-border px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon aria-hidden className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{ITEM_TYPE_LABELS[item.itemType]}</span>
                      {place ? <span>{place}</span> : null}
                      {estimate ? <span className="font-medium text-foreground">{estimate}</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => void reorder(item.id, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${item.title} up`}
                      className="rounded-card border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => void reorder(item.id, 1)}
                      disabled={index === trip.unscheduledItems.length - 1}
                      aria-label={`Move ${item.title} down`}
                      className="rounded-card border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setEditing(item);
                      }}
                      aria-label={`Edit ${item.title}`}
                      className="rounded-card border border-border p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil aria-hidden className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(item)}
                      aria-label={`Remove ${item.title}`}
                      className="rounded-card border border-border p-1.5 text-muted-foreground hover:text-accent"
                    >
                      <Trash2 aria-hidden className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                  <CalendarPlus aria-hidden className="h-3.5 w-3.5" />
                  {trip.days.length === 0 ? (
                    <span>Add a day first to schedule this idea.</span>
                  ) : (
                    <label className="flex items-center gap-1.5">
                      <span>Schedule on</span>
                      <select
                        value=""
                        disabled={pendingId === item.id}
                        onChange={(event) => {
                          if (event.target.value) void schedule(item.id, event.target.value);
                        }}
                        className="rounded-card border border-border bg-card px-1.5 py-0.5 text-[11px] outline-none focus:border-primary"
                      >
                        <option value="">Choose a day…</option>
                        {trip.days.map((day) => (
                          <option key={day.id} value={day.id}>
                            Day {day.dayNumber}
                            {day.title ? ` — ${day.title}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {pendingId === item.id ? (
                    <span role="status" className="inline-flex items-center gap-1">
                      <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
                      Scheduling…
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <ItineraryItemForm
          key={editing.id}
          tripId={trip.id}
          day={null}
          initial={editing}
          destinationOptions={destinationOptions}
          currencyCode={trip.currencyCode}
          onSaved={onChange}
          onCancel={() => setEditing(null)}
        />
      ) : adding ? (
        <ItineraryItemForm
          key="new-idea"
          tripId={trip.id}
          day={null}
          destinationOptions={destinationOptions}
          currencyCode={trip.currencyCode}
          onSaved={(updated) => {
            onChange(updated);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setAdding(true);
          }}
          className={`${secondaryButtonClass} mt-3`}
        >
          <Plus aria-hidden className="mr-1.5 inline h-4 w-4" />
          Add an idea
        </button>
      )}
    </section>
  );
}
