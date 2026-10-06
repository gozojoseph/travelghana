"use client";

import { FormEvent, useEffect, useState } from "react";

import { api, type CityDto, type ExperienceDto, type ExperiencePayload } from "@/lib/api";

import { buttonClass, Field, FormFeedback, inputClass, submitForm, toCedisDisplay, toMinorUnits } from "./shared";

/** Create (initial = null) or edit (initial = experience) an experience listing. */
export function ExperienceForm({ initial, onSaved }: { initial?: ExperienceDto | null; onSaved?: () => void }) {
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

    const payload: ExperiencePayload = {
      title: trim("title"),
      description: optional("description"),
      durationMinutes: optionalInt("durationMinutes"),
      priceMinor: toMinorUnits(trim("priceMinor")),
      cityId: optional("cityId"),
      category: optional("category"),
      published: data.get("published") === "on",
    };

    await submitForm(
      async () => {
        if (initial) {
          await api.updateExperience(initial.id, payload);
        } else {
          await api.createExperience(payload);
        }
        onSaved?.();
        window.location.href = "/operator/experiences";
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

      <Field label="Experience title" error={fieldErrors.title}>
        <input name="title" required defaultValue={initial?.title ?? ""} maxLength={120} className={inputClass} placeholder="e.g. Kente Weaving Workshop" />
      </Field>

      <Field label="Description" error={fieldErrors.description}>
        <textarea name="description" rows={6} defaultValue={initial?.description ?? ""} maxLength={5000} className={inputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Duration (minutes)" error={fieldErrors.durationMinutes} hint="15–1440">
          <input name="durationMinutes" type="number" min={15} max={1440} defaultValue={initial?.durationMinutes ?? ""} className={inputClass} />
        </Field>
        <Field label="Price per person (GHS)" error={fieldErrors.priceMinor}>
          <input
            name="priceMinor"
            required
            type="number"
            step="0.01"
            min={0}
            defaultValue={initial ? toCedisDisplay(initial.priceMinor) : ""}
            className={inputClass}
          />
        </Field>
        <Field label="Category" error={fieldErrors.category} hint="e.g. culture, food">
          <input name="category" defaultValue={initial?.category ?? ""} maxLength={60} className={inputClass} />
        </Field>
      </div>

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

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="published" defaultChecked={initial?.published ?? false} className="h-4 w-4 accent-[#006B3F]" />
        Published — bookable/searchable by travelers
      </label>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : initial ? "Save changes" : "Create experience"}
      </button>
    </form>
  );
}
