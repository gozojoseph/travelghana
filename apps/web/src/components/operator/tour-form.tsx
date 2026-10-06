"use client";

import { FormEvent, useEffect, useState } from "react";

import { api, type CityDto, type TourDto, type TourPayload } from "@/lib/api";

import { buttonClass, Field, FormFeedback, inputClass, submitForm, toCedisDisplay, toMinorUnits } from "./shared";

/** Create (initial = null) or edit (initial = tour) a tour listing. */
export function TourForm({ initial, onSaved }: { initial?: TourDto | null; onSaved?: () => void }) {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [cities, setCities] = useState<CityDto[]>([]);

  useEffect(() => {
    api
      .cities()
      .then((res) => setCities(res.items))
      .catch(() => setCities([]));
  }, []);

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

    const payload: TourPayload = {
      title: trim("title"),
      summary: optional("summary"),
      description: optional("description"),
      durationHours: optionalInt("durationHours"),
      days: optionalInt("days"),
      groupMin: optionalInt("groupMin") ?? 1,
      groupMax: optionalInt("groupMax") ?? 10,
      basePriceMinor: toMinorUnits(trim("basePriceMinor")),
      cityId: optional("cityId"),
      meetingPoint: optional("meetingPoint"),
      category: optional("category"),
      published: data.get("published") === "on",
    };

    await submitForm(
      async () => {
        if (initial) {
          await api.updateTour(initial.id, payload);
        } else {
          await api.createTour(payload);
        }
        onSaved?.();
        window.location.href = "/operator/tours";
      },
      (s) => {
        setPending(s.pending);
        setFormError(s.formError);
        setFieldErrors(s.fieldErrors);
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormFeedback message={formError} />

      <Field label="Tour title" error={fieldErrors.title}>
        <input name="title" required defaultValue={initial?.title ?? ""} maxLength={120} className={inputClass} placeholder="e.g. Cape Coast & Elmina Day Trip" />
      </Field>

      <Field label="Short summary" error={fieldErrors.summary} hint="Shown on cards — one or two sentences.">
        <input name="summary" defaultValue={initial?.summary ?? ""} maxLength={280} className={inputClass} />
      </Field>

      <Field label="Full description" error={fieldErrors.description}>
        <textarea name="description" rows={6} defaultValue={initial?.description ?? ""} maxLength={5000} className={inputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Duration (hours)" error={fieldErrors.durationHours}>
          <input name="durationHours" type="number" min={1} max={720} defaultValue={initial?.durationHours ?? ""} className={inputClass} />
        </Field>
        <Field label="Days" error={fieldErrors.days}>
          <input name="days" type="number" min={1} max={30} defaultValue={initial?.days ?? ""} className={inputClass} />
        </Field>
        <Field label="Category" error={fieldErrors.category} hint="e.g. heritage, nature">
          <input name="category" defaultValue={initial?.category ?? ""} maxLength={60} className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Min group size" error={fieldErrors.groupMin}>
          <input name="groupMin" type="number" min={1} max={50} defaultValue={initial?.groupMin ?? 1} className={inputClass} />
        </Field>
        <Field label="Max group size" error={fieldErrors.groupMax}>
          <input name="groupMax" type="number" min={1} max={100} defaultValue={initial?.groupMax ?? 10} className={inputClass} />
        </Field>
        <Field label="Price per person (GHS)" error={fieldErrors.basePriceMinor}>
          <input
            name="basePriceMinor"
            required
            type="number"
            step="0.01"
            min={0}
            defaultValue={initial ? toCedisDisplay(initial.basePriceMinor) : ""}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meeting point" error={fieldErrors.meetingPoint}>
          <input name="meetingPoint" defaultValue={initial?.meetingPoint ?? ""} maxLength={200} className={inputClass} placeholder="e.g. Independence Square, Accra" />
        </Field>
        <Field label="Base city" error={fieldErrors.cityId}>
          <select name="cityId" defaultValue={initial?.cityId ?? ""} className={inputClass}>
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

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="published" defaultChecked={initial?.published ?? false} className="h-4 w-4 accent-[#006B3F]" />
        Published — bookable/searchable by travelers
      </label>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : initial ? "Save changes" : "Create tour"}
      </button>
    </form>
  );
}
