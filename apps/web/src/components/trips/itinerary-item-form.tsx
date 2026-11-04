"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import type {
  ItineraryDay,
  ItineraryItem,
  ItineraryItemType,
  PricingBasis,
  TripDestinationOption,
  TripDetail,
} from "@travelghana/types";
import {
  itineraryItemCreateSchema,
  itineraryItemUpdateSchema,
  PRICING_BASIS_VALUES,
} from "@travelghana/validation";

import { toCedisDisplay, toMinorUnits } from "@/lib/format";
import { timeOfDay } from "@/lib/trips/date";
import { tripsSource } from "@/lib/trips";

import {
  buttonClass,
  Field,
  FormFeedback,
  inputClass,
  issueMap,
  ITEM_TYPE_LABELS,
  ITEM_TYPES,
  PRICING_BASIS_LABELS,
  secondaryButtonClass,
} from "./shared";

interface ItineraryItemFormProps {
  tripId: string;
  /** `null` while adding/editing an idea in the unscheduled tray. */
  day: ItineraryDay | null;
  initial?: ItineraryItem;
  /** Opens preset for a "where to sleep" entry (D32). */
  stayQuickAdd?: boolean;
  destinationOptions: TripDestinationOption[];
  currencyCode: string;
  onSaved: (trip: TripDetail) => void;
  onCancel: () => void;
}

/** Add/edit form for one itinerary activity or unscheduled idea. */
export function ItineraryItemForm({
  tripId,
  day,
  initial,
  stayQuickAdd = false,
  destinationOptions,
  currencyCode,
  onSaved,
  onCancel,
}: ItineraryItemFormProps) {
  const listingEstimate = initial?.estimateSource === "LISTING";
  const [title, setTitle] = useState(initial?.title ?? "");
  const [itemType, setItemType] = useState<ItineraryItemType>(
    initial?.itemType ?? (stayQuickAdd ? "ACCOMMODATION" : "ATTRACTION"),
  );
  const [startTime, setStartTime] = useState(timeOfDay(initial?.startTime ?? null));
  const [endTime, setEndTime] = useState(timeOfDay(initial?.endTime ?? null));
  const [destinationId, setDestinationId] = useState(initial?.destination?.id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [cost, setCost] = useState(
    initial?.estimatedCostMinor !== null && initial?.estimatedCostMinor !== undefined
      ? toCedisDisplay(initial.estimatedCostMinor)
      : "",
  );
  const [pricingBasis, setPricingBasis] = useState<PricingBasis | "">(
    initial?.pricingBasis ?? "",
  );
  const [manualOverride, setManualOverride] = useState(!listingEstimate);
  const includeEstimate = !listingEstimate || manualOverride;
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    let costMinor: number | null = null;
    if (cost.trim() !== "") {
      const parsedCost = Number.parseFloat(cost);
      if (!Number.isFinite(parsedCost) || parsedCost < 0) {
        setFieldErrors({ estimatedCostMinor: "Enter an amount like 250.00" });
        return;
      }
      costMinor = toMinorUnits(cost);
    }

    const estimateFields = includeEstimate
      ? {
          estimatedCostMinor: costMinor,
          currencyCode: costMinor === null ? null : currencyCode,
          pricingBasis: costMinor === null ? null : pricingBasis || null,
          // Editing a listing snapshot turns it into the traveler's own
          // estimate; the server must not overwrite it from the listing.
          estimateSource: costMinor === null ? null : ("MANUAL" as const),
        }
      : {};

    const payload = {
      title: title.trim(),
      itemType,
      startTime: startTime || null,
      endTime: endTime || null,
      destinationId: destinationId || null,
      notes: notes.trim() || null,
      ...estimateFields,
    };

    setPending(true);
    try {
      if (initial) {
        const parsed = itineraryItemUpdateSchema.safeParse(payload);
        if (!parsed.success) {
          setFieldErrors(issueMap(parsed.error.issues));
          setPending(false);
          return;
        }
        onSaved(await tripsSource.updateItem(tripId, initial.id, parsed.data));
      } else {
        const parsed = itineraryItemCreateSchema.safeParse(payload);
        if (!parsed.success) {
          setFieldErrors(issueMap(parsed.error.issues));
          setPending(false);
          return;
        }
        onSaved(
          day
            ? await tripsSource.addItem(tripId, day.id, parsed.data)
            : await tripsSource.addUnscheduledItem(tripId, parsed.data),
        );
      }
      setPending(false);
      onCancel();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the activity");
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="animate-pop mt-3 flex flex-col gap-4 rounded-card border border-border bg-muted/40 p-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={itemType === "ACCOMMODATION" ? "Where to sleep" : "Activity"}
          error={fieldErrors.title}
        >
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={
              itemType === "ACCOMMODATION"
                ? "e.g. Coastal lodge in Cape Coast"
                : "Canopy walkway + guided trail"
            }
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.title)}
          />
        </Field>
        <Field label="Type" error={fieldErrors.itemType}>
          <select
            value={itemType}
            onChange={(event) => setItemType(event.target.value as ItineraryItemType)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.itemType)}
          >
            {ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {ITEM_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {itemType !== "ACCOMMODATION" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Start time"
            error={fieldErrors.startTime}
            hint={day?.date ? "Optional." : "Assign it to a day before setting a time."}
          >
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              disabled={!day?.date}
              className={`${inputClass} disabled:opacity-50`}
              aria-invalid={Boolean(fieldErrors.startTime)}
            />
          </Field>
          <Field label="End time" error={fieldErrors.endTime} hint="Optional.">
            <input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              disabled={!day?.date}
              className={`${inputClass} disabled:opacity-50`}
              aria-invalid={Boolean(fieldErrors.endTime)}
            />
          </Field>
        </div>
      ) : null}

      <Field
        label="Destination"
        error={fieldErrors.destinationId}
        hint="Link this activity to a place in Ghana."
      >
        <select
          value={destinationId}
          onChange={(event) => setDestinationId(event.target.value)}
          className={inputClass}
          aria-invalid={Boolean(fieldErrors.destinationId)}
        >
          <option value="">No destination</option>
          {destinationOptions.map((destination) => (
            <option key={destination.id} value={destination.id}>
              {destination.name}
              {destination.cityName ? ` — ${destination.cityName}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="rounded-card border border-border bg-card/60 p-3">
        <legend className="px-1 text-sm font-medium">Cost estimate</legend>
        <p className="text-xs text-muted-foreground">
          An estimate helps with budgeting. It is never a confirmed price or a booking.
        </p>

        {listingEstimate && initial ? (
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <p>
              Current snapshot:{" "}
              <span className="font-medium">
                {initial.estimatedCostMinor !== null
                  ? `${currencyCode} ${toCedisDisplay(initial.estimatedCostMinor)}`
                  : "No price"}
              </span>{" "}
              from the linked listing.
            </p>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={manualOverride}
                onChange={(event) => setManualOverride(event.target.checked)}
              />
              Replace the listing snapshot with my own estimate
            </label>
          </div>
        ) : null}

        {includeEstimate ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field
              label={`Estimate (${currencyCode})`}
              error={fieldErrors.estimatedCostMinor}
              hint="Optional. Leave blank if unknown."
            >
              <input
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                placeholder="250.00"
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.estimatedCostMinor)}
              />
            </Field>
            <Field
              label="Charged"
              error={fieldErrors.pricingBasis}
              hint="Required when you enter a cost."
            >
              <select
                value={pricingBasis}
                onChange={(event) => setPricingBasis(event.target.value as PricingBasis | "")}
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.pricingBasis)}
              >
                <option value="">Choose…</option>
                {PRICING_BASIS_VALUES.map((basis) => (
                  <option key={basis} value={basis}>
                    {PRICING_BASIS_LABELS[basis]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}
      </fieldset>

      <Field
        label="Notes"
        error={fieldErrors.notes}
        hint="Booking references, meeting points, reminders."
      >
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className={inputClass}
          aria-invalid={Boolean(fieldErrors.notes)}
        />
      </Field>

      <FormFeedback message={formError} />

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? <Loader2 aria-hidden className="mr-2 inline h-4 w-4 animate-spin" /> : null}
          {initial
            ? itemType === "ACCOMMODATION"
              ? "Save sleep plan"
              : "Save activity"
            : day
              ? itemType === "ACCOMMODATION"
                ? "Add sleep plan"
                : "Add activity"
              : "Add idea"}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}
