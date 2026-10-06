"use client";

import { FormEvent, useEffect, useState } from "react";

import { api, PROVIDER_TYPE_LABELS, type CityDto, type ProviderType } from "@/lib/api";

import { buttonClass, Field, FormFeedback, inputClass, submitForm } from "./shared";

const PROVIDER_TYPES = Object.keys(PROVIDER_TYPE_LABELS) as ProviderType[];

/**
 * Provider onboarding (D5 operator-first): one account, one provider (1:1),
 * self-service — verification is a separate admin step.
 */
export function ProviderForm() {
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
    const type = String(data.get("type") ?? "") as ProviderType;
    const name = String(data.get("name") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const contactEmail = String(data.get("contactEmail") ?? "").trim();
    const contactPhone = String(data.get("contactPhone") ?? "").trim();
    const cityId = String(data.get("cityId") ?? "");

    await submitForm(
      async () => {
        await api.onboardProvider({
          type,
          name,
          ...(description ? { description } : {}),
          ...(contactEmail ? { contactEmail } : {}),
          ...(contactPhone ? { contactPhone } : {}),
          ...(cityId ? { cityId } : {}),
        });
        window.location.href = "/operator";
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

      <Field label="What kind of business do you run?" error={fieldErrors.type}>
        <select name="type" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Choose a type…
          </option>
          {PROVIDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROVIDER_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Business name" error={fieldErrors.name}>
        <input name="name" required minLength={2} maxLength={120} className={inputClass} placeholder="e.g. Accra Adventures" />
      </Field>

      <Field label="Description" error={fieldErrors.description} hint="What do you offer travelers? (optional)">
        <textarea name="description" rows={4} maxLength={2000} className={inputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact email" error={fieldErrors.contactEmail}>
          <input name="contactEmail" type="email" className={inputClass} placeholder="bookings@…" />
        </Field>
        <Field label="Contact phone" error={fieldErrors.contactPhone}>
          <input name="contactPhone" className={inputClass} placeholder="+233 …" />
        </Field>
      </div>

      <Field label="Base city" error={fieldErrors.cityId}>
        <select name="cityId" defaultValue="" className={inputClass}>
          <option value="">Anywhere in Ghana</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.region ? `, ${c.region.name}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Creating profile…" : "Create operator profile"}
      </button>
    </form>
  );
}
