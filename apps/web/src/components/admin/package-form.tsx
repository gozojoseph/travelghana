"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { PackageDetail, PackageStatus, TripDestinationOption } from "@travelghana/types";
import {
  packageCreateSchema,
  packageUpdateSchema,
  type PackageCreateInput,
  type PackageUpdateInput,
} from "@travelghana/validation";

import { api } from "@/lib/api";
import { toCedisDisplay, toMinorUnits } from "@/lib/format";
import { tripsSource } from "@/lib/trips";

import {
  buttonClass,
  Field,
  FormFeedback,
  inputClass,
  issueMap,
  PACKAGE_STATUS_LABELS,
  PACKAGE_STATUSES,
  secondaryButtonClass,
} from "./shared";

interface DayDraft {
  title: string;
  description: string;
  meals: string;
  accommodation: string;
}

interface PackageFormProps {
  mode: "create" | "edit";
  initial?: PackageDetail;
  onSaved: (pkg: PackageDetail) => void;
  onCancel?: () => void;
}

const MAX_DAYS = 30;

/** Admin package editor — one payload, including the whole day outline. */
export function PackageForm({ mode, initial, onSaved, onCancel }: PackageFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [destinationId, setDestinationId] = useState(initial?.destination?.id ?? "");
  const [durationDays, setDurationDays] = useState(String(initial?.durationDays ?? 3));
  const [durationNights, setDurationNights] = useState(String(initial?.durationNights ?? 2));
  const [price, setPrice] = useState(initial ? toCedisDisplay(initial.priceMinor) : "");
  const [heroImageUrl, setHeroImageUrl] = useState(initial?.heroImageUrl ?? "");
  const [inclusions, setInclusions] = useState(initial?.inclusions ?? "");
  const [exclusions, setExclusions] = useState(initial?.exclusions ?? "");
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [status, setStatus] = useState<PackageStatus>(initial?.status ?? "DRAFT");
  const [days, setDays] = useState<DayDraft[]>(
    initial?.days.map((day) => ({
      title: day.title,
      description: day.description ?? "",
      meals: day.meals ?? "",
      accommodation: day.accommodation ?? "",
    })) ?? [],
  );

  const [destinations, setDestinations] = useState<TripDestinationOption[]>([]);
  const [destinationsError, setDestinationsError] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    tripsSource
      .destinations()
      .then((options) => {
        if (active) setDestinations(options);
      })
      .catch(() => {
        if (active) setDestinationsError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateDay(index: number, patch: Partial<DayDraft>) {
    setDays((prev) => prev.map((day, i) => (i === index ? { ...day, ...patch } : day)));
  }

  function addDay() {
    setDays((prev) => [
      ...prev,
      {
        title: `Day ${prev.length + 1}`,
        description: "",
        meals: "",
        accommodation: "",
      },
    ]);
  }

  function removeDay(index: number) {
    setDays((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsedDays = Number.parseInt(durationDays, 10);
    const parsedNights = Number.parseInt(durationNights, 10);
    const parsedPrice = Number.parseFloat(price);

    const nextFieldErrors: Record<string, string> = {};
    if (!Number.isFinite(parsedDays)) {
      nextFieldErrors.durationDays = "Enter a whole number of days";
    }
    if (!Number.isFinite(parsedNights)) {
      nextFieldErrors.durationNights = "Enter a whole number of nights";
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      nextFieldErrors.priceMinor = "Enter an amount like 2500.00";
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    const payload = {
      title: title.trim(),
      summary: summary.trim(),
      description: description.trim(),
      destinationId: destinationId || null,
      durationDays: parsedDays,
      durationNights: parsedNights,
      priceMinor: toMinorUnits(price),
      currencyCode: "GHS",
      heroImageUrl: heroImageUrl.trim() === "" ? null : heroImageUrl.trim(),
      inclusions: inclusions.trim(),
      exclusions: exclusions.trim(),
      featured,
      days: days.map((day, index) => ({
        dayNumber: index + 1,
        title: day.title.trim(),
        description: day.description.trim(),
        meals: day.meals.trim(),
        accommodation: day.accommodation.trim(),
      })),
    };

    const parsed =
      mode === "create"
        ? packageCreateSchema.safeParse(payload)
        : packageUpdateSchema.safeParse({ ...payload, status });

    if (!parsed.success) {
      setFieldErrors(issueMap(parsed.error.issues));
      setFormError("Please fix the highlighted fields.");
      return;
    }

    setPending(true);
    try {
      if (mode === "create") {
        const { package: created } = await api.createPackage(
          parsed.data as PackageCreateInput,
        );
        onSaved(created);
      } else {
        if (!initial) throw new Error("Package not found");
        const { package: updated } = await api.updatePackage(
          initial.id,
          parsed.data as PackageUpdateInput,
        );
        onSaved(updated);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the package");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <section className="flex flex-col gap-4">
        <Field label="Title" error={fieldErrors.title}>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Cape Coast heritage & coastline"
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.title)}
          />
        </Field>

        <Field
          label="Short summary"
          error={fieldErrors.summary}
          hint="One or two lines shown on package cards. Up to 300 characters."
        >
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Forts, fishing villages and Atlantic beaches over four unhurried days."
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.summary)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Destination"
            error={fieldErrors.destinationId}
            hint="Optional — packages can span several places."
          >
            <select
              value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.destinationId)}
            >
              <option value="">No destination</option>
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                  {destination.regionName ? ` · ${destination.regionName}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Days" error={fieldErrors.durationDays}>
            <input
              type="number"
              min={1}
              max={30}
              value={durationDays}
              onChange={(event) => setDurationDays(event.target.value)}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.durationDays)}
            />
          </Field>

          <Field label="Nights" error={fieldErrors.durationNights}>
            <input
              type="number"
              min={0}
              max={29}
              value={durationNights}
              onChange={(event) => setDurationNights(event.target.value)}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.durationNights)}
            />
          </Field>
        </div>

        {destinationsError ? (
          <p className="text-xs text-muted-foreground">
            Could not load destinations — you can still save the package without one.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Price (GHS)"
            error={fieldErrors.priceMinor}
            hint="From-price shown on the package. Bookings are not enabled yet."
          >
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="2500.00"
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.priceMinor)}
            />
          </Field>

          <Field
            label="Hero image URL"
            error={fieldErrors.heroImageUrl}
            hint="Optional — paste an https image URL."
          >
            <input
              type="url"
              value={heroImageUrl}
              onChange={(event) => setHeroImageUrl(event.target.value)}
              placeholder="https://…"
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.heroImageUrl)}
            />
          </Field>
        </div>

        <Field
          label="Description"
          error={fieldErrors.description}
          hint="The longer story: what the package is for, who it suits, what makes it special."
        >
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.description)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="What's included"
            error={fieldErrors.inclusions}
            hint="One item per line works well."
          >
            <textarea
              value={inclusions}
              onChange={(event) => setInclusions(event.target.value)}
              rows={4}
              placeholder={"3 nights accommodation\nDaily breakfast\nLocal guide"}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.inclusions)}
            />
          </Field>

          <Field
            label="Not included"
            error={fieldErrors.exclusions}
            hint="Flights, visas, optional activities…"
          >
            <textarea
              value={exclusions}
              onChange={(event) => setExclusions(event.target.value)}
              rows={4}
              placeholder={"International flights\nTravel insurance"}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.exclusions)}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={featured}
              onChange={(event) => setFeatured(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Feature this package
          </label>

          {mode === "edit" ? (
            <label className="flex items-center gap-2 text-sm font-medium">
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as PackageStatus)}
                className="rounded-card border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
              >
                {PACKAGE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {PACKAGE_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">New packages start as drafts.</p>
          )}
        </div>
      </section>

      <section className="rounded-card border border-border bg-muted/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium">Day-by-day outline</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Optional editorial content. The outline can be shorter than the package duration.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {days.length}/{MAX_DAYS} days
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {days.map((day, index) => (
            <div
              key={index}
              className="animate-rise rounded-card border border-border bg-card p-4 [animation-fill-mode:backwards]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Day {index + 1}</p>
                <button
                  type="button"
                  onClick={() => removeDay(index)}
                  className="rounded-card p-1 text-muted-foreground transition-colors hover:text-accent"
                  aria-label={`Remove day ${index + 1}`}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-3">
                <Field label="Title" error={fieldErrors[`days.${index}.title`]}>
                  <input
                    type="text"
                    value={day.title}
                    onChange={(event) => updateDay(index, { title: event.target.value })}
                    placeholder="Arrive, settle in and eat by the sea"
                    className={inputClass}
                    aria-invalid={Boolean(fieldErrors[`days.${index}.title`])}
                  />
                </Field>

                <Field label="What happens" error={fieldErrors[`days.${index}.description`]}>
                  <textarea
                    value={day.description}
                    onChange={(event) => updateDay(index, { description: event.target.value })}
                    rows={2}
                    placeholder="A relaxed first day: check in, walk the old town, dinner at a local spot."
                    className={inputClass}
                    aria-invalid={Boolean(fieldErrors[`days.${index}.description`])}
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Meals" error={fieldErrors[`days.${index}.meals`]}>
                    <input
                      type="text"
                      value={day.meals}
                      onChange={(event) => updateDay(index, { meals: event.target.value })}
                      placeholder="Breakfast, lunch"
                      className={inputClass}
                      aria-invalid={Boolean(fieldErrors[`days.${index}.meals`])}
                    />
                  </Field>
                  <Field
                    label="Accommodation"
                    error={fieldErrors[`days.${index}.accommodation`]}
                  >
                    <input
                      type="text"
                      value={day.accommodation}
                      onChange={(event) =>
                        updateDay(index, { accommodation: event.target.value })
                      }
                      placeholder="Beachfront lodge"
                      className={inputClass}
                      aria-invalid={Boolean(fieldErrors[`days.${index}.accommodation`])}
                    />
                  </Field>
                </div>
              </div>
            </div>
          ))}
        </div>

        {fieldErrors.days ? (
          <p className="mt-3 text-xs text-red-600">{fieldErrors.days}</p>
        ) : null}

        <button
          type="button"
          onClick={addDay}
          disabled={days.length >= MAX_DAYS}
          className={`${secondaryButtonClass} mt-4 inline-flex items-center gap-1.5`}
        >
          <Plus aria-hidden className="h-4 w-4" />
          Add day
        </button>
      </section>

      <FormFeedback message={formError} />

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? (
            <Loader2 aria-hidden className="mr-2 inline h-4 w-4 animate-spin" />
          ) : null}
          {mode === "create" ? "Create draft" : "Save changes"}
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
