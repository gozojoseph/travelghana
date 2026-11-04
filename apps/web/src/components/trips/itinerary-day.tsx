"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { BedDouble, Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import type {
  ItineraryDay,
  ItineraryItem,
  TripDestinationOption,
  TripDetail,
} from "@travelghana/types";
import { itineraryDayUpdateSchema } from "@travelghana/validation";

import { formatMoney } from "@/lib/format";
import { formatDayHeading, formatTimeRange } from "@/lib/trips/date";
import { tripsSource } from "@/lib/trips";

import { ItineraryItemForm } from "./itinerary-item-form";
import { ITEM_ICONS } from "./item-icons";
import {
  buttonClass,
  Field,
  FormFeedback,
  inputClass,
  issueMap,
  ITEM_TYPE_LABELS,
  PRICING_BASIS_LABELS,
  secondaryButtonClass,
} from "./shared";

const TIME_GROUPS = [
  { key: "morning", label: "Morning", from: 0, to: 12 },
  { key: "afternoon", label: "Afternoon", from: 12, to: 17 },
  { key: "evening", label: "Evening", from: 17, to: 24 },
] as const;

type TimeGroupKey = (typeof TIME_GROUPS)[number]["key"] | "anytime";

function groupFor(item: ItineraryItem): TimeGroupKey {
  if (!item.startTime) return "anytime";
  const hour = Number(item.startTime.slice(11, 13));
  return TIME_GROUPS.find((group) => hour >= group.from && hour < group.to)?.key ?? "anytime";
}

function durationLabel(item: ItineraryItem): string | null {
  if (!item.startTime || !item.endTime) return null;
  const start = new Date(item.startTime).getTime();
  const end = new Date(item.endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const minutes = Math.round((end - start) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function linkedPlace(item: ItineraryItem): { name: string; href?: string } | null {
  if (item.destination) {
    return { name: item.destination.name, href: `/destinations/${item.destination.slug}` };
  }
  if (item.attraction) return { name: item.attraction.name };
  if (item.tour) return { name: item.tour.title };
  if (item.experience) return { name: item.experience.title };
  if (item.package) return { name: item.package.title };
  return null;
}

interface ItineraryDayCardProps {
  tripId: string;
  day: ItineraryDay;
  days: ItineraryDay[];
  currencyCode: string;
  destinationOptions: TripDestinationOption[];
  onChange: (trip: TripDetail) => void;
  onError: (message: string) => void;
}

/** One editable day in the itinerary workspace. */
export function ItineraryDayCard({
  tripId,
  day,
  days,
  currencyCode,
  destinationOptions,
  onChange,
  onError,
}: ItineraryDayCardProps) {
  const [adding, setAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [stayAdding, setStayAdding] = useState(false);
  const [stayEditing, setStayEditing] = useState<ItineraryItem | null>(null);
  const [dayEditing, setDayEditing] = useState(false);
  const [dayTitle, setDayTitle] = useState(day.title ?? "");
  const [dayNotes, setDayNotes] = useState(day.notes ?? "");
  const [dayPending, setDayPending] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  async function move(itemId: string, direction: -1 | 1) {
    const ids = day.items.map((item) => item.id);
    const index = ids.indexOf(itemId);
    const target = index + direction;
    const first = ids[index];
    const second = ids[target];
    if (index < 0 || target < 0 || target >= ids.length || !first || !second) return;
    ids[index] = second;
    ids[target] = first;
    try {
      onChange(await tripsSource.reorderItems(tripId, day.id, ids));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not reorder the activities");
    }
  }

  async function moveTo(itemId: string, targetDayId: string | null) {
    setMovingId(itemId);
    try {
      onChange(await tripsSource.moveItem(tripId, itemId, targetDayId));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not move the activity");
    } finally {
      setMovingId(null);
    }
  }

  async function removeItem(item: ItineraryItem) {
    if (!window.confirm(`Remove "${item.title}" from this day?`)) return;
    try {
      onChange(await tripsSource.removeItem(tripId, item.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not remove the activity");
    }
  }

  async function removeDay() {
    if (!window.confirm(`Delete day ${day.dayNumber}?`)) return;
    try {
      onChange(await tripsSource.removeDay(tripId, day.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not delete the day");
    }
  }

  async function saveDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDayError(null);
    const parsed = itineraryDayUpdateSchema.safeParse({
      title: dayTitle.trim() || null,
      notes: dayNotes.trim() || null,
    });
    if (!parsed.success) {
      const issues = issueMap(parsed.error.issues);
      setDayError(issues.title ?? issues.notes ?? "Check the day details");
      return;
    }
    setDayPending(true);
    try {
      onChange(await tripsSource.updateDay(tripId, day.id, parsed.data));
      setDayPending(false);
      setDayEditing(false);
    } catch (err) {
      setDayError(err instanceof Error ? err.message : "Could not update the day");
      setDayPending(false);
    }
  }

  // Sleep plans (Stay items) render in their own block, not inside the
  // clock-time buckets — a night's lodging is not a timed activity (D32).
  const stays = day.items.filter((item) => item.itemType === "ACCOMMODATION");
  const activities = day.items.filter((item) => item.itemType !== "ACCOMMODATION");

  const groups = [
    ...TIME_GROUPS.map((group) => ({
      ...group,
      items: activities.filter((item) => groupFor(item) === group.key),
    })),
    {
      key: "anytime" as const,
      label: "Any time",
      items: activities.filter((item) => groupFor(item) === "anytime"),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <section
      id={`day-${day.id}`}
      aria-labelledby={`day-${day.id}-title`}
      className="scroll-mt-24 rounded-card border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-secondary">
            Day {day.dayNumber}
          </p>
          <h2 id={`day-${day.id}-title`} className="mt-0.5 font-display text-xl">
            {day.title ?? formatDayHeading(day.date)}
          </h2>
          <p className="text-sm text-muted-foreground">{formatDayHeading(day.date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDayTitle(day.title ?? "");
              setDayNotes(day.notes ?? "");
              setDayError(null);
              setDayEditing((current) => !current);
            }}
            className={secondaryButtonClass}
          >
            <Pencil aria-hidden className="mr-1.5 inline h-3.5 w-3.5" />
            Edit day
          </button>
          <button
            type="button"
            onClick={() => void removeDay()}
            disabled={day.items.length > 0}
            title={
              day.items.length > 0
                ? "Remove the activities on this day before deleting it"
                : "Delete this day"
            }
            className={secondaryButtonClass}
          >
            <Trash2 aria-hidden className="mr-1.5 inline h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>

      {dayEditing ? (
        <form
          onSubmit={saveDay}
          className="animate-pop mt-4 flex flex-col gap-3 rounded-card border border-border bg-muted/40 p-4"
          noValidate
        >
          <Field label="Day title">
            <input
              type="text"
              value={dayTitle}
              onChange={(event) => setDayTitle(event.target.value)}
              placeholder="Kakum rainforest"
              className={inputClass}
            />
          </Field>
          <Field label="Day notes">
            <textarea
              value={dayNotes}
              onChange={(event) => setDayNotes(event.target.value)}
              rows={2}
              className={inputClass}
            />
          </Field>
          <FormFeedback message={dayError} />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={dayPending} className={buttonClass}>
              {dayPending ? (
                <Loader2 aria-hidden className="mr-2 inline h-4 w-4 animate-spin" />
              ) : null}
              Save day
            </button>
            <button
              type="button"
              onClick={() => setDayEditing(false)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : day.notes ? (
        <p className="mt-2 text-sm text-muted-foreground">{day.notes}</p>
      ) : null}

      <section
        aria-label={`Where to sleep on day ${day.dayNumber}`}
        className="mt-4 rounded-card border border-border bg-muted/30 px-3 py-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BedDouble aria-hidden className="h-4 w-4 text-primary" />
            Where to sleep
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              optional
            </span>
          </p>
          {!stayAdding && !stayEditing ? (
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setEditingItem(null);
                setStayEditing(null);
                setStayAdding(true);
              }}
              className="rounded-card border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-95"
            >
              <Plus aria-hidden className="mr-1 inline h-3.5 w-3.5" />
              {stays.length === 0 ? "Add sleep plan" : "Add another"}
            </button>
          ) : null}
        </div>

        {stays.length === 0 && !stayAdding && !stayEditing ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Not decided yet. Leave it open for now, or add a lodge, guesthouse or town.
          </p>
        ) : null}

        {stays.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-2">
            {stays.map((item) => {
              const estimate =
                item.estimatedCostMinor !== null
                  ? `${formatMoney(
                      item.estimatedCostMinor,
                      item.currencyCode ?? currencyCode,
                    )}${item.pricingBasis ? ` ${PRICING_BASIS_LABELS[item.pricingBasis]}` : ""}`
                  : null;

              return (
                <li
                  key={item.id}
                  className="rounded-card border border-border bg-card px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{item.title}</p>
                      {item.notes ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.notes}</p>
                      ) : null}
                      {estimate ? (
                        <p
                          className="mt-0.5 text-xs font-medium text-foreground"
                          title="Traveler estimate — not a confirmed price"
                        >
                          {estimate}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${item.title}`}
                        onClick={() => {
                          setAdding(false);
                          setEditingItem(null);
                          setStayAdding(false);
                          setStayEditing(item);
                        }}
                        className="rounded-card border border-border p-2 text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-90"
                      >
                        <Pencil aria-hidden className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeItem(item)}
                        aria-label={`Remove ${item.title}`}
                        className="rounded-card border border-border p-2 text-muted-foreground transition-[color,transform] duration-150 hover:text-accent active:scale-90"
                      >
                        <Trash2 aria-hidden className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                    <label className="flex items-center gap-1.5">
                      <span className="sr-only">Which night {item.title} belongs to</span>
                      <select
                        value={day.id}
                        disabled={movingId === item.id}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value && value !== day.id) void moveTo(item.id, value);
                        }}
                        className="rounded-card border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary"
                      >
                        {days.map((target) => (
                          <option key={target.id} value={target.id}>
                            Night {target.dayNumber}
                            {target.title ? ` — ${target.title}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    {movingId === item.id ? (
                      <span role="status" className="inline-flex items-center gap-1">
                        <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
                        Moving…
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {stayAdding || stayEditing ? (
          <ItineraryItemForm
            key={stayEditing?.id ?? "new-stay"}
            tripId={tripId}
            day={day}
            initial={stayEditing ?? undefined}
            stayQuickAdd
            destinationOptions={destinationOptions}
            currencyCode={currencyCode}
            onSaved={(trip) => {
              onChange(trip);
              setStayAdding(false);
              setStayEditing(null);
            }}
            onCancel={() => {
              setStayAdding(false);
              setStayEditing(null);
            }}
          />
        ) : null}
      </section>

      {activities.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No activities yet. Add the first activity, or schedule an idea from the tray.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.key} aria-label={`${group.label} on day ${day.dayNumber}`}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </h3>
              <ul className="tg-stagger flex flex-col gap-2">
                {group.items.map((item) => {
                  const Icon = ITEM_ICONS[item.itemType];
                  const time = formatTimeRange(item.startTime, item.endTime);
                  const duration = durationLabel(item);
                  const place = linkedPlace(item);
                  const index = day.items.findIndex((entry) => entry.id === item.id);
                  const estimate =
                    item.estimatedCostMinor !== null
                      ? `${formatMoney(
                          item.estimatedCostMinor,
                          item.currencyCode ?? currencyCode,
                        )}${item.pricingBasis ? ` ${PRICING_BASIS_LABELS[item.pricingBasis]}` : ""}`
                      : null;

                  return (
                    <li key={item.id} className="rounded-card border border-border px-3 py-3 sm:px-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icon aria-hidden className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <p className="font-medium">{item.title}</p>
                            {item.estimateSource === "LISTING" ? (
                              <span className="rounded-full bg-secondary/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground">
                                Listing snapshot
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{ITEM_TYPE_LABELS[item.itemType]}</span>
                            {time ? <span>{time}</span> : null}
                            {duration ? <span>{duration}</span> : null}
                            {place ? (
                              place.href ? (
                                <Link
                                  href={place.href}
                                  className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                                >
                                  <MapPin aria-hidden className="h-3.5 w-3.5" />
                                  {place.name}
                                </Link>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin aria-hidden className="h-3.5 w-3.5" />
                                  {place.name}
                                </span>
                              )
                            ) : null}
                            {estimate ? (
                              <span className="font-medium text-foreground" title="Traveler estimate — not a confirmed price">
                                {estimate}
                              </span>
                            ) : (
                              <span className="italic">No cost estimate</span>
                            )}
                          </p>
                          {item.notes ? (
                            <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void move(item.id, -1)}
                            disabled={index <= 0}
                            aria-label={`Move ${item.title} earlier`}
                            className="rounded-card border border-border px-2 py-1 text-xs text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-95 disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => void move(item.id, 1)}
                            disabled={index === day.items.length - 1}
                            aria-label={`Move ${item.title} later`}
                            className="rounded-card border border-border px-2 py-1 text-xs text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-95 disabled:opacity-40"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAdding(false);
                              setStayAdding(false);
                              setStayEditing(null);
                              setEditingItem(item);
                            }}
                            aria-label={`Edit ${item.title}`}
                            className="rounded-card border border-border p-2 text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-90"
                          >
                            <Pencil aria-hidden className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeItem(item)}
                            aria-label={`Remove ${item.title}`}
                            className="rounded-card border border-border p-2 text-muted-foreground transition-[color,transform] duration-150 hover:text-accent active:scale-90"
                          >
                            <Trash2 aria-hidden className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                        <label className="flex items-center gap-1.5">
                          <span className="sr-only">Move {item.title} to</span>
                          <select
                            value=""
                            disabled={movingId === item.id}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (!value) return;
                              void moveTo(item.id, value === "unscheduled" ? null : value);
                            }}
                            className="rounded-card border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary"
                          >
                            <option value="">Move to…</option>
                            {days
                              .filter((target) => target.id !== day.id)
                              .map((target) => (
                                <option key={target.id} value={target.id}>
                                  Day {target.dayNumber}
                                  {target.title ? ` — ${target.title}` : ""}
                                </option>
                              ))}
                            <option value="unscheduled">Ideas (unscheduled)</option>
                          </select>
                        </label>
                        {movingId === item.id ? (
                          <span role="status" className="inline-flex items-center gap-1">
                            <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
                            Moving…
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editingItem ? (
        <ItineraryItemForm
          key={editingItem.id}
          tripId={tripId}
          day={day}
          initial={editingItem}
          destinationOptions={destinationOptions}
          currencyCode={currencyCode}
          onSaved={onChange}
          onCancel={() => setEditingItem(null)}
        />
      ) : adding ? (
        <ItineraryItemForm
          key="new"
          tripId={tripId}
          day={day}
          destinationOptions={destinationOptions}
          currencyCode={currencyCode}
          onSaved={(trip) => {
            onChange(trip);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditingItem(null);
            setStayAdding(false);
            setStayEditing(null);
            setAdding(true);
          }}
          className={`${secondaryButtonClass} mt-4`}
        >
          <Plus aria-hidden className="mr-1.5 inline h-4 w-4" />
          Add activity
        </button>
      )}
    </section>
  );
}
