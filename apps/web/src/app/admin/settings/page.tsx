"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { SiteSettings } from "@travelghana/types";
import { siteSettingsUpdateSchema } from "@travelghana/validation";

import { api } from "@/lib/api";
import {
  buttonClass,
  Field,
  formatDateTime,
  FormFeedback,
  inputClass,
  issueMap,
} from "@/components/admin/shared";

type FormValues = Record<
  | "phone"
  | "whatsapp"
  | "email"
  | "address"
  | "facebookUrl"
  | "instagramUrl"
  | "twitterUrl"
  | "youtubeUrl"
  | "momoInstructions"
  | "bankInstructions",
  string
>;

const EMPTY: FormValues = {
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  facebookUrl: "",
  instagramUrl: "",
  twitterUrl: "",
  youtubeUrl: "",
  momoInstructions: "",
  bankInstructions: "",
};

/** Map the stored settings (nullable) onto the form's empty-string contract. */
function toFormValues(s: SiteSettings | null): FormValues {
  if (!s) return EMPTY;
  return {
    phone: s.phone ?? "",
    whatsapp: s.whatsapp ?? "",
    email: s.email ?? "",
    address: s.address ?? "",
    facebookUrl: s.facebookUrl ?? "",
    instagramUrl: s.instagramUrl ?? "",
    twitterUrl: s.twitterUrl ?? "",
    youtubeUrl: s.youtubeUrl ?? "",
    momoInstructions: s.momoInstructions ?? "",
    bankInstructions: s.bankInstructions ?? "",
  };
}

export default function AdminSettingsPage() {
  const [values, setValues] = useState<FormValues | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .siteSettings()
      .then(({ settings }) => {
        if (!active) return;
        setValues(toFormValues(settings));
        setUpdatedAt(settings.updatedAt);
      })
      .catch(() => {
        if (active) setLoadError("Could not load the site settings. Is the API running?");
      });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    if (!values) return;
    // Validate client-side first; the API repeats the check (full replace).
    const parsed = siteSettingsUpdateSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(issueMap(parsed.error.issues));
      setError("Please fix the highlighted fields.");
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const { settings } = await api.adminUpdateSettings(parsed.data);
      setValues(toFormValues(settings));
      setUpdatedAt(settings.updatedAt);
      setFeedback("Saved. The footer and about page show the new details right away.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the settings.");
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof FormValues) => (value: string) => {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 pb-24">
      <div>
        <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
          Admin
        </p>
        <h1 className="animate-rise mt-1 font-display text-4xl [animation-delay:40ms]">
          Settings
        </h1>
        <p className="animate-rise mt-2 max-w-2xl text-muted-foreground [animation-delay:80ms]">
          Public contact details, social links and manual payment instructions for the public
          site and booking emails. Leave a field empty to hide it; changes go live immediately.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {feedback ? (
          <p
            role="status"
            className="animate-pop rounded-card border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
          >
            {feedback}
          </p>
        ) : null}
        <FormFeedback message={loadError ?? error} />
      </div>

      {values === null && !loadError ? (
        <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          Loading settings…
        </p>
      ) : null}

      {values !== null && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="mt-8 max-w-3xl space-y-10"
        >
          <section>
            <h2 className="font-display text-2xl">Contact</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Shows in the site footer and on the about page.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Phone" hint="Include the country code, e.g. +233 …" error={fieldErrors.phone}>
                <input
                  type="tel"
                  value={values.phone}
                  onChange={(e) => set("phone")(e.target.value)}
                  className={inputClass}
                  placeholder="+233 30 123 4567"
                />
              </Field>
              <Field label="WhatsApp" hint="Written as a phone number; linked through wa.me" error={fieldErrors.whatsapp}>
                <input
                  type="tel"
                  value={values.whatsapp}
                  onChange={(e) => set("whatsapp")(e.target.value)}
                  className={inputClass}
                  placeholder="+233 55 123 4567"
                />
              </Field>
              <Field label="Email" error={fieldErrors.email}>
                <input
                  type="email"
                  value={values.email}
                  onChange={(e) => set("email")(e.target.value)}
                  className={inputClass}
                  placeholder="hello@travelghana.example"
                />
              </Field>
              <Field label="Address" error={fieldErrors.address}>
                <input
                  type="text"
                  value={values.address}
                  onChange={(e) => set("address")(e.target.value)}
                  className={inputClass}
                  placeholder="Independence Avenue, Accra"
                />
              </Field>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl">Social media</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Full links, e.g. https://facebook.com/travelghana. Empty fields are hidden.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Facebook URL" error={fieldErrors.facebookUrl}>
                <input
                  type="url"
                  value={values.facebookUrl}
                  onChange={(e) => set("facebookUrl")(e.target.value)}
                  className={inputClass}
                  placeholder="https://facebook.com/…"
                />
              </Field>
              <Field label="Instagram URL" error={fieldErrors.instagramUrl}>
                <input
                  type="url"
                  value={values.instagramUrl}
                  onChange={(e) => set("instagramUrl")(e.target.value)}
                  className={inputClass}
                  placeholder="https://instagram.com/…"
                />
              </Field>
              <Field label="X (Twitter) URL" error={fieldErrors.twitterUrl}>
                <input
                  type="url"
                  value={values.twitterUrl}
                  onChange={(e) => set("twitterUrl")(e.target.value)}
                  className={inputClass}
                  placeholder="https://x.com/…"
                />
              </Field>
              <Field label="YouTube URL" error={fieldErrors.youtubeUrl}>
                <input
                  type="url"
                  value={values.youtubeUrl}
                  onChange={(e) => set("youtubeUrl")(e.target.value)}
                  className={inputClass}
                  placeholder="https://youtube.com/…"
                />
              </Field>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl">Payments (manual)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              How travelers pay for confirmed bookings - shown in confirmation emails verbatim,
              with their booking code as the payment reference. Nothing is charged or stored on
              the site; keep any amounts out of the platform data.
            </p>
            <div className="mt-4 flex flex-col gap-4">
              <Field
                label="Mobile Money instructions"
                hint="e.g. number, network, account name. Empty = left out of the email."
                error={fieldErrors.momoInstructions}
              >
                <textarea
                  rows={4}
                  value={values.momoInstructions}
                  onChange={(e) => set("momoInstructions")(e.target.value)}
                  className={inputClass}
                  placeholder={"024 000 0000, MTN MoMo - Account name: TravelGhana Ltd"}
                />
              </Field>
              <Field
                label="Bank transfer instructions"
                hint="e.g. bank, account number, name. Empty = left out of the email."
                error={fieldErrors.bankInstructions}
              >
                <textarea
                  rows={4}
                  value={values.bankInstructions}
                  onChange={(e) => set("bankInstructions")(e.target.value)}
                  className={inputClass}
                  placeholder={"GCB Bank\nAccount: 1234 5678 9012\nAccount name: TravelGhana Ltd"}
                />
              </Field>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={saving} className={`${buttonClass} inline-flex items-center gap-2`}>
              {saving ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Save aria-hidden className="h-4 w-4" />}
              {saving ? "Saving…" : "Save settings"}
            </button>
            {updatedAt ? (
              <p className="text-sm text-muted-foreground">Last saved {formatDateTime(updatedAt)}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Never saved yet</p>
            )}
          </div>
        </form>
      )}
    </main>
  );
}
