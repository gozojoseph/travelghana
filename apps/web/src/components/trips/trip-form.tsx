"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type {
  BudgetTier,
  BudgetType,
  TravelPace,
  TripDestinationOption,
  TripDetail,
  TripInterest,
} from "@travelghana/types";
import {
  BUDGET_TIER_VALUES,
  BUDGET_TYPE_VALUES,
  TRAVEL_PACE_VALUES,
  TRIP_INTEREST_VALUES,
  tripCreateSchema,
  tripUpdateSchema,
} from "@travelghana/validation";

import { toCedisDisplay, toMinorUnits } from "@/lib/format";
import { tripsSource } from "@/lib/trips";

import {
  BUDGET_TIER_HINTS,
  BUDGET_TIER_LABELS,
  BUDGET_TYPE_LABELS,
  buttonClass,
  Field,
  FormFeedback,
  inputClass,
  INTEREST_LABELS,
  issueMap,
  secondaryButtonClass,
  TRAVEL_PACE_HINTS,
  TRAVEL_PACE_LABELS,
} from "./shared";

interface TripFormProps {
  mode: "create" | "edit";
  initial?: TripDetail;
  onSaved: (trip: TripDetail) => void;
  onCancel?: () => void;
}

/** Trip details + planner preferences — used for create and inline editing. */
export function TripForm({ mode, initial, onSaved, onCancel }: TripFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [adults, setAdults] = useState(String(initial?.adults ?? 1));
  const [children, setChildren] = useState(String(initial?.children ?? 0));
  const [budget, setBudget] = useState(
    initial?.budgetMinor !== null && initial?.budgetMinor !== undefined
      ? toCedisDisplay(initial.budgetMinor)
      : "",
  );
  const [budgetType, setBudgetType] = useState<BudgetType>(initial?.budgetType ?? "PER_GROUP");
  const [budgetTier, setBudgetTier] = useState<BudgetTier>(initial?.budgetTier ?? "FLEXIBLE");
  const [budgetIncludesFlights, setBudgetIncludesFlights] = useState(
    initial?.budgetIncludesFlights ?? false,
  );
  const [interests, setInterests] = useState<TripInterest[]>(initial?.interests ?? []);
  const [travelPace, setTravelPace] = useState<TravelPace>(initial?.travelPace ?? "BALANCED");
  const [arrivalPoint, setArrivalPoint] = useState(initial?.arrivalPoint ?? "");
  const [destinationPreferences, setDestinationPreferences] = useState<string[]>(
    initial?.destinationPreferences ?? [],
  );
  const [destinationOptions, setDestinationOptions] = useState<TripDestinationOption[]>([]);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    tripsSource
      .destinations()
      .then((options) => {
        if (active) setDestinationOptions(options);
      })
      .catch(() => {
        // The picker degrades to whatever was already selected.
      });
    return () => {
      active = false;
    };
  }, []);

  function toggleInterest(interest: TripInterest) {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((entry) => entry !== interest)
        : [...current, interest],
    );
  }

  function toggleDestination(destinationId: string) {
    setDestinationPreferences((current) =>
      current.includes(destinationId)
        ? current.filter((entry) => entry !== destinationId)
        : [...current, destinationId],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    let budgetMinor: number | null = null;
    if (budget.trim() !== "") {
      const parsedBudget = Number.parseFloat(budget);
      if (!Number.isFinite(parsedBudget)) {
        setFieldErrors({ budgetMinor: "Enter an amount like 4500.00" });
        return;
      }
      budgetMinor = toMinorUnits(budget);
    }

    const payload = {
      name: name.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      adults: Number.parseInt(adults, 10),
      children: Number.parseInt(children, 10),
      budgetMinor,
      currencyCode: initial?.currencyCode ?? "GHS",
      notes: notes.trim() || null,
      interests,
      travelPace,
      budgetTier,
      budgetType,
      budgetIncludesFlights,
      arrivalPoint: arrivalPoint.trim() || null,
      destinationPreferences,
    };

    setPending(true);
    try {
      if (mode === "create") {
        const parsed = tripCreateSchema.safeParse(payload);
        if (!parsed.success) {
          setFieldErrors(issueMap(parsed.error.issues));
          setPending(false);
          return;
        }
        onSaved(await tripsSource.create(parsed.data));
      } else {
        const parsed = tripUpdateSchema.safeParse(payload);
        if (!parsed.success) {
          setFieldErrors(issueMap(parsed.error.issues));
          setPending(false);
          return;
        }
        if (!initial) throw new Error("Trip not found");
        onSaved(await tripsSource.update(initial.id, parsed.data));
      }
      setPending(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the trip");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Trip name" error={fieldErrors.name}>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Cape Coast heritage weekend"
          className={inputClass}
          aria-invalid={Boolean(fieldErrors.name)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Start date"
          error={fieldErrors.startDate}
          hint="Optional — you can add dates later."
        >
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.startDate)}
          />
        </Field>
        <Field label="End date" error={fieldErrors.endDate} hint="We generate one itinerary day per date.">
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.endDate)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Adults" error={fieldErrors.adults}>
          <input
            type="number"
            min={1}
            max={30}
            value={adults}
            onChange={(event) => setAdults(event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.adults)}
          />
        </Field>
        <Field label="Children" error={fieldErrors.children}>
          <input
            type="number"
            min={0}
            max={20}
            value={children}
            onChange={(event) => setChildren(event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.children)}
          />
        </Field>
        <Field label="Arrival point" error={fieldErrors.arrivalPoint} hint="Optional.">
          <input
            type="text"
            value={arrivalPoint}
            onChange={(event) => setArrivalPoint(event.target.value)}
            placeholder="Kotoka International Airport (ACC)"
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.arrivalPoint)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Budget (GHS)" error={fieldErrors.budgetMinor} hint="Optional.">
          <input
            type="number"
            min={0}
            step="0.01"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            placeholder="4500.00"
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.budgetMinor)}
          />
        </Field>
        <Field label="Budget is for" error={fieldErrors.budgetType}>
          <select
            value={budgetType}
            onChange={(event) => setBudgetType(event.target.value as BudgetType)}
            className={inputClass}
          >
            {BUDGET_TYPE_VALUES.map((type) => (
              <option key={type} value={type}>
                {BUDGET_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={budgetIncludesFlights}
          onChange={(event) => setBudgetIncludesFlights(event.target.checked)}
        />
        My budget includes flights
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Budget style" error={fieldErrors.budgetTier}>
          <select
            value={budgetTier}
            onChange={(event) => setBudgetTier(event.target.value as BudgetTier)}
            className={inputClass}
          >
            {BUDGET_TIER_VALUES.map((tier) => (
              <option key={tier} value={tier}>
                {BUDGET_TIER_LABELS[tier]}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">
            {BUDGET_TIER_HINTS[budgetTier]}
          </span>
        </Field>
        <Field label="Travel pace" error={fieldErrors.travelPace}>
          <select
            value={travelPace}
            onChange={(event) => setTravelPace(event.target.value as TravelPace)}
            className={inputClass}
          >
            {TRAVEL_PACE_VALUES.map((pace) => (
              <option key={pace} value={pace}>
                {TRAVEL_PACE_LABELS[pace]}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">
            {TRAVEL_PACE_HINTS[travelPace]}
          </span>
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">What are you interested in?</legend>
        <div className="flex flex-wrap gap-1.5">
          {TRIP_INTEREST_VALUES.map((interest) => {
            const selected = interests.includes(interest);
            return (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-[color,background-color,border-color] duration-150 ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {INTEREST_LABELS[interest]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Places you want to include</legend>
        <p className="mb-2 text-xs text-muted-foreground">
          Optional. These help you remember the shape of the trip; they do not reserve anything.
        </p>
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-card border border-border p-2">
          {destinationOptions.map((destination) => {
            const selected = destinationPreferences.includes(destination.id);
            return (
              <button
                key={destination.id}
                type="button"
                onClick={() => toggleDestination(destination.id)}
                aria-pressed={selected}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-[color,background-color,border-color] duration-150 ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {destination.name}
              </button>
            );
          })}
          {destinationOptions.length === 0 ? (
            <span className="px-1 py-1 text-xs text-muted-foreground">
              Places are unavailable right now.
            </span>
          ) : null}
        </div>
      </fieldset>

      <Field
        label="Notes"
        error={fieldErrors.notes}
        hint="Anything you want to remember while planning."
      >
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className={inputClass}
          aria-invalid={Boolean(fieldErrors.notes)}
        />
      </Field>

      <FormFeedback message={formError} />

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? <Loader2 aria-hidden className="mr-2 inline h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Create trip" : "Save changes"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
