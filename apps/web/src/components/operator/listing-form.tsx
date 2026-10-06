"use client";

import { FormEvent, useEffect, useState } from "react";

import { api, type CityDto, type ListingCreatePayload, type ListingStatus, type ListingSummaryDto } from "@/lib/api";

import { buttonClass, Field, FormFeedback, inputClass, submitForm, toCedisDisplay, toMinorUnits } from "./shared";

/** Shape accepted by the server listing create/update routes. */
type Initial = Partial<ListingSummaryDto & ListingCreatePayload> & {
  published?: boolean;
};

/** Create (initial = null) or edit (initial = ListingSummaryDto) a reusable listing. */
export function ListingForm({ mode, initial }: { mode: "create" | "edit"; initial?: Initial }) {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [cities, setCities] = useState<CityDto[]>([]);
  const [regions, setRegions] = useState<Array<{ id: string; name: string; slug: string; region?: { name: string; slug: string } }>>([]);

  useEffect(() => {
    api
      .cities()
      .then((res) => setCities(res.items))
      .catch(() => setCities([]));
  }, []);

  async function loadRegions() {
    try {
      const res = await fetch("/api/destinations/regions", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as Array<{
          id: string;
          name: string;
          slug: string;
          cities: Array<{ slug: string; name: string }>;
        }>;
        setRegions(
          data.flatMap((r) =>
            r.cities.map((c) => ({ id: r.id, name: r.name, slug: r.slug, region: { name: r.name, slug: r.slug } } satisfies { id: string; name: string; slug: string; region?: { name: string; slug: string } })).map((c) => ({
              id: c.id,
              name: c.region ? `${c.name}, ${c.region.name}` : c.name,
              slug: c.slug,
              region: c.region,
            })),
          ),
        );
      }
    } catch {
      // API unreachable (e.g. not started yet) — fields degrade gracefully.
    }
  }

  useEffect(() => {
    loadRegions();
  }, []);

  // Seed region options from the destinations endpoint so the provider can
  // pick a broader service area without knowing a city id.
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const trim = (key: string) => String(data.get(key) ?? "").trim();
    const optional = (key: string) => {
      const value = trim(key);
      return value ? value : undefined;
    };
    const optionalInt = (key: string): number | undefined => {
      const value = trim(key);
      if (!value) return undefined;
      const n = Number.parseInt(value, 10);
      return Number.isFinite(n) ? n : undefined;
    };

    const payload: ListingCreatePayload = {
      title: trim("title"),
      description: optional("description"),
      serviceArea: optional("serviceArea"),
      durationMinutes: optionalInt("durationMinutes"),
      capacity: optionalInt("capacity") ?? 1,
      priceMinor: toMinorUnits(trim("priceMinor")),
      currencyCode: optional("currencyCode") ?? "GHS",
      cityId: optional("cityId"),
      regionId: optional("regionId"),
      coordinatesLat: optionalInt("coordinatesLat") !== undefined ? optionalInt("coordinatesLat") : undefined,
      coordinatesLng: optionalInt("coordinatesLng") !== undefined ? optionalInt("coordinatesLng") : undefined,
      address: optional("address"),
      meetingPoint: optional("meetingPoint"),
      category: optional("category"),
      whatIsIncluded: optional("whatIsIncluded"),
      whatIsExcluded: optional("whatIsExcluded"),
      requirements: optional("requirements"),
      cancellationPolicy: optional("cancellationPolicy"),
      heroImageUrl: optional("heroImageUrl"),
      published: mode === "create" ? data.get("published") === "on" : (initial?.published ?? false),
    };

    await submitForm(
      async () => {
        if (mode === "edit" && initial) {
          await api.updateListing(initial.id, payload);
        } else {
          await api.createListing(payload);
        }
        window.location.href = "/operator/listings";
      },
      (s) => {
        setPending(s.pending);
        setFormError(s.formError);
        setFieldErrors(s.fieldErrors);
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormFeedback message={formError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" error={fieldErrors.title}>
          <input
            name="title"
            required
            defaultValue={mode === "edit" && initial ? initial.title : ""}
            maxLength={120}
            className={inputClass}
            placeholder="e.g. Cape Coast & Elmina Day Trip"
          />
        </Field>
        <Field label="Category" error={fieldErrors.category}>
          <select name="category" className={inputClass} defaultValue={mode === "edit" && initial ? initial.category ?? "" : ""}>
            <option value="">Select a category…</option>
            {["TOUR", "EXPERIENCE", "HOTEL", "RESTAURANT", "EVENT", "TRANSPORT", "DRIVER", "SHOPPING", "OTHER"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description" error={fieldErrors.description}>
        <textarea
          name="description"
          rows={4}
          defaultValue={mode === "edit" && initial ? initial.description ?? "" : ""}
          maxLength={5000}
          className={inputClass}
          placeholder="What do you offer? Travelers read this first."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service area" error={fieldErrors.serviceArea}>
          <textarea
            name="serviceArea"
            rows={2}
            maxLength={1000}
            className={inputClass}
            placeholder="e.g. All of Greater Accra and Eastern Region"
          />
        </Field>
        <Field label="Location" error={fieldErrors.cityId}>
          <select name="cityId" className={inputClass} defaultValue={mode === "edit" && initial ? initial.cityId ?? "" : ""}>
            <option value="">Anywhere in Ghana</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.region ? `, ${c.region.name}` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Region" error={fieldErrors.regionId}>
          <select name="regionId" className={inputClass} defaultValue={mode === "edit" && initial ? initial.regionId ?? "" : ""}>
            <option value="">Any region</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Address" error={fieldErrors.address}>
          <input
            name="address"
            maxLength={300}
            className={inputClass}
            placeholder="Street + house number"
            defaultValue={mode === "edit" && initial ? initial.address ?? "" : ""}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Duration (minutes)" error={fieldErrors.durationMinutes}>
          <input
            name="durationMinutes"
            type="number"
            min={1}
            max={1440}
            className={inputClass}
            defaultValue={mode === "edit" && initial ? initial.durationMinutes ?? "" : ""}
          />
        </Field>
        <Field label="Capacity" error={fieldErrors.capacity}>
          <input
            name="capacity"
            type="number"
            min={1}
            max={10000}
            className={inputClass}
            defaultValue={mode === "edit" && initial ? initial.capacity ?? 1 : 1}
          />
        </Field>
        <Field label="Price per person (GHS)" error={fieldErrors.priceMinor}>
          <input
            name="priceMinor"
            required
            type="number"
            step="0.01"
            min={0}
            className={inputClass}
            defaultValue={mode === "edit" && initial ? toCedisDisplay(initial.priceMinor) : ""}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Coordinates – latitude" error={fieldErrors.coordinatesLat}>
          <input
            name="coordinatesLat"
            type="number"
            step="0.0001"
            className={inputClass}
            placeholder="5.6037"
            defaultValue={mode === "edit" && initial ? initial.coordinatesLat?.toString() ?? "" : ""}
          />
        </Field>
        <Field label="Coordinates – longitude" error={fieldErrors.coordinatesLng}>
          <input
            name="coordinatesLng"
            type="number"
            step="0.0001"
            className={inputClass}
            placeholder="-0.187"
            defaultValue={mode === "edit" && initial ? initial.coordinatesLng?.toString() ?? "" : ""}
          />
        </Field>
        <Field label="Meeting point" error={fieldErrors.meetingPoint}>
          <input
            name="meetingPoint"
            maxLength={200}
            className={inputClass}
            placeholder="e.g. Independence Square, Accra"
            defaultValue={mode === "edit" && initial ? initial.meetingPoint ?? "" : ""}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What's included" error={fieldErrors.whatIsIncluded}>
          <textarea
            name="whatIsIncluded"
            rows={3}
            maxLength={5000}
            className={inputClass}
            placeholder="e.g. 2-hour guided walk, professional guide, all entry fees"
          />
        </Field>
        <Field label="What's excluded" error={fieldErrors.whatIsExcluded}>
          <textarea
            name="whatIsExcluded"
            rows={3}
            maxLength={5000}
            className={inputClass}
            placeholder="e.g. Gratuities, food and drinks, transport to meeting point"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Requirements" error={fieldErrors.requirements}>
          <textarea
            name="requirements"
            rows={2}
            maxLength={5000}
            className={inputClass}
            placeholder="e.g. comfortable shoes, moderate fitness"
          />
        </Field>
        <Field label="Cancellation policy" error={fieldErrors.cancellationPolicy}>
          <textarea
            name="cancellationPolicy"
            rows={2}
            maxLength={2000}
            className={inputClass}
            placeholder="e.g. Free cancellation up to 24h before"
          />
        </Field>
      </div>

      <Field label="Hero image URL" error={fieldErrors.heroImageUrl}>
        <input
          name="heroImageUrl"
          className={inputClass}
          placeholder="https://example.com/image.jpg"
          defaultValue={mode === "edit" && initial ? initial.heroImageUrl ?? "" : ""}
        />
      </Field>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="published"
          defaultChecked={mode === "edit" && initial ? initial.published ?? false : false}
          className="h-4 w-4 accent-[#006B3F]"
        />
        Published — bookable/searchable by travelers
      </label>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create listing"}
      </button>
    </form>
  );
}
