"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type { PackageDepartureDto } from "@travelghana/types";

import { api } from "@/lib/api";
import { FormFeedback, inputClass, secondaryButtonClass } from "@/components/admin/shared";

const dangerButtonClass =
  "inline-flex items-center gap-1.5 rounded-card border border-accent/40 bg-card px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-50";

const actionButtonClass =
  "inline-flex items-center gap-1.5 rounded-card border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted/60 disabled:opacity-50";

/** UTC-midnight departure dates, labelled like the public booking form. */
function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function pastLabel(iso: string): string | null {
  const time = new Date(`${iso}T00:00:00Z`).getTime();
  return time <= Date.now() - 24 * 60 * 60 * 1000 ? "past" : null;
}

/**
 * Departures manager on the package editor (D41): explicit dates with seat
 * counts, plus the weekly quick-add for recurring journeys. Seats still held
 * by live bookings block seat cuts below the held number and block deletes -
 * the release has to happen through cancelling the bookings themselves.
 */
export function PackageDeparturesCard({ packageId }: { packageId: string }) {
  const [items, setItems] = useState<PackageDepartureDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Add form: "YYYY-MM-DD" strings like the booking form sends.
  const [date, setDate] = useState("");
  const [seats, setSeats] = useState("6");
  const [weeks, setWeeks] = useState("1");

  const [seatDraft, setSeatDraft] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    api
      .adminDepartures(packageId)
      .then(({ departures }) => {
        setItems(departures);
        setError(null);
      })
      .catch((err) => {
        setItems([]);
        setError(err instanceof Error ? err.message : "Could not load departures.");
      });
  }, [packageId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(kind: "single" | "weekly") {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const seatsNumber = Number(seats);
      if (kind === "single") {
        const { departures } = await api.adminCreateDeparture(packageId, {
          startDate: date,
          seats: seatsNumber,
        });
        setFeedback(`Departure added for ${formatDate(departures[0]!.date)}.`);
      } else {
        const { created } = await api.adminCreateDeparturesWeekly(packageId, {
          startDate: date,
          seats: seatsNumber,
          weeks: Number(weeks),
        });
        setFeedback(
          `${created} weekly departure${created === 1 ? "" : "s"} added` +
            (created < Number(weeks) ? ` (the other dates already had one).` : "."),
        );
      }
      setDate("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the departure.");
    } finally {
      setBusy(false);
    }
  }

  async function setSeatsFor(departure: PackageDepartureDto) {
    const raw = seatDraft[departure.id];
    const next = Number(raw ?? departure.seats);
    setBusy(true);
    setError(null);
    try {
      const res = await api.adminUpdateDeparture(packageId, departure.id, next);
      setItems((prev) =>
        (prev ?? []).map((row) => (row.id === departure.id ? res.departure : row)),
      );
      setFeedback(`Seats updated for ${formatDate(res.departure.date)}.`);
      setSeatDraft((prev) => {
        const next2 = { ...prev };
        delete next2[departure.id];
        return next2;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the seats.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(departure: PackageDepartureDto) {
    if (
      !window.confirm(
        `Delete the departure on ${formatDate(departure.date)}? Only possible while no bookings hold seats on it.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.adminDeleteDeparture(packageId, departure.id);
      setItems((prev) => (prev ?? []).filter((row) => row.id !== departure.id));
      setFeedback("Departure deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the departure.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Departures &amp; seats</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add explicit dates to make this journey set-dated; travelers then pick one from
            the booking form and their party holds seats until cancelled. Leave the list
            empty to keep the package open-dated.
          </p>
        </div>
        <button type="button" onClick={load} className={actionButtonClass} aria-label="Reload departures">
          <RefreshCw aria-hidden className="h-3.5 w-3.5" /> Reload
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <FormFeedback message={error} />
        {feedback ? (
          <p role="status" className="animate-pop rounded-card border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
            {feedback}
          </p>
        ) : null}
      </div>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void add(weeks !== "1" ? "weekly" : "single");
        }}
        className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_auto]"
      >
        <label className="text-sm">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">First date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={`${inputClass} mt-1`}
            required
          />
        </label>
        <label className="text-sm">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Seats</span>
          <input
            type="number"
            min={1}
            max={200}
            value={seats}
            onChange={(event) => setSeats(event.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-sm">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Repeat weeks</span>
          <input
            type="number"
            min={1}
            max={12}
            value={weeks}
            onChange={(event) => setWeeks(event.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={busy || !date} className={secondaryButtonClass}>
            {busy ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus aria-hidden className="h-4 w-4" />
            )}
            {weeks !== "1" ? "Add weekly" : "Add date"}
          </button>
        </div>
      </form>

      {items === null ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Loading departures...
        </p>
      ) : null}
      {items !== null && items.length === 0 ? (
        <p className="mt-5 rounded-card border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          No departures yet - this package is open-dated: travelers choose any start date.
        </p>
      ) : null}
      {items !== null && items.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2">
          {items.map((dep) => {
            const past = pastLabel(dep.date);
            const held = dep.seats - dep.remaining;
            const draft = seatDraft[dep.id];
            return (
              <li
                key={dep.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {formatDate(dep.date)}
                    {past ? (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        past date
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {held > 0
                      ? `${held} of ${dep.seats} seats held by live bookings - ${dep.remaining} left`
                      : `${dep.seats} seats - all open`}
                    {dep.remaining < 0 ? " (overbooked - add seats)" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={draft ?? String(dep.seats)}
                    onChange={(event) =>
                      setSeatDraft((prev) => ({ ...prev, [dep.id]: event.target.value }))
                    }
                    aria-label={`Seats for ${formatDate(dep.date)}`}
                    className={`${inputClass} w-24`}
                  />
                  <button
                    type="button"
                    onClick={() => void setSeatsFor(dep)}
                    disabled={busy || draft === undefined || draft === String(dep.seats)}
                    className={actionButtonClass}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(dep)}
                    disabled={busy || held > 0}
                    aria-label={`Delete departure ${formatDate(dep.date)}`}
                    title={held > 0 ? "Bookings still hold seats on this date" : "Delete"}
                    className={dangerButtonClass}
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
