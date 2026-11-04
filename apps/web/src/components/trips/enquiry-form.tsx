"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  Users,
  Wallet,
} from "lucide-react";
import type { TripDestinationOption, TripInterest } from "@travelghana/types";
import {
  BUDGET_RANGE_OPTIONS,
  enquiryCreateSchema,
  TRIP_INTEREST_VALUES,
  type EnquiryCreateInput,
} from "@travelghana/validation";

import { createEnquiry } from "@/lib/enquiries";
import { trackEvent } from "@/lib/tracking";
import { tripsSource } from "@/lib/trips";

import { INTEREST_LABELS } from "./shared";
import {
  buttonClass,
  Field,
  FormFeedback,
  inputClass,
  issueMap,
} from "./shared";

/**
 * Public concierge enquiry (D6). No account required — the traveler tells us
 * what they want and a human replies by email. This is an enquiry, never a
 * booking: no prices are promised and nothing is charged.
 */
export function EnquiryForm() {
  const [destinationOptions, setDestinationOptions] = useState<TripDestinationOption[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [destinations, setDestinations] = useState<string[]>([]);
  const [interests, setInterests] = useState<TripInterest[]>([]);
  const [budgetRange, setBudgetRange] = useState("");
  const [accommodationPref, setAccommodationPref] = useState("");
  const [transportPref, setTransportPref] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void tripsSource
      .destinations()
      .then((options) => {
        if (active) setDestinationOptions(options);
      })
      .catch(() => {
        // The destination picker stays empty; the form remains usable.
      });
    return () => {
      active = false;
    };
  }, []);

  function toggleDestination(nameOption: string) {
    setDestinations((current) =>
      current.includes(nameOption)
        ? current.filter((entry) => entry !== nameOption)
        : [...current, nameOption],
    );
  }

  function toggleInterest(interest: TripInterest) {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((entry) => entry !== interest)
        : [...current, interest],
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (name.trim().length < 2 || email.trim() === "") {
      setFieldErrors({
        ...(name.trim().length < 2 ? { name: "The concierge needs a name to address the reply" } : {}),
        ...(email.trim() === "" ? { email: "An email is needed so the concierge can respond" } : {}),
      });
      return;
    }

    const payload: EnquiryCreateInput = {
      name: name.trim(),
      email: email.trim(),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(Number.parseInt(adults, 10) > 0 ? { adults: Number.parseInt(adults, 10) } : {}),
      ...(Number.parseInt(children, 10) > 0 ? { children: Number.parseInt(children, 10) } : {}),
      ...(destinations.length > 0 ? { destinations } : {}),
      ...(interests.length > 0 ? { interests } : {}),
      ...(budgetRange ? { budgetRange } : {}),
      ...(accommodationPref.trim() ? { accommodationPref: accommodationPref.trim() } : {}),
      ...(transportPref.trim() ? { transportPref: transportPref.trim() } : {}),
      ...(specialRequests.trim() ? { specialRequests: specialRequests.trim() } : {}),
    };

    const parsed = enquiryCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(issueMap(parsed.error.issues));
      return;
    }

    setPending(true);
    try {
      const { enquiry } = await createEnquiry(parsed.data);
      trackEvent("enquiry_created", { code: enquiry.code });
      setReference(enquiry.code);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not send the enquiry");
      setPending(false);
    }
  }

  if (reference) {
    return (
      <div className="rounded-card border border-border bg-card p-6 text-center">
        <CheckCircle2 aria-hidden className="mx-auto h-10 w-10 text-primary" />
        <h3 className="mt-3 text-lg font-semibold">Enquiry sent</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your reference is{" "}
          <span className="font-mono font-semibold text-foreground">{reference}</span>. A member of
          our concierge team will reply to{" "}
          <span className="font-semibold">{email}</span> by email.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          This is an enquiry, not a booking — nothing is charged here.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormFeedback message={formError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" error={fieldErrors.name}>
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={120}
          />
        </Field>
        <Field label="Email" error={fieldErrors.email}>
          <input
            className={inputClass}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            maxLength={200}
          />
        </Field>
      </div>

      <Field
        label="Phone (optional)"
        error={fieldErrors.phone}
        hint="Useful for urgent questions while you travel."
      >
        <input
          className={inputClass}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="tel"
          maxLength={30}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Adults">
          <input
            className={inputClass}
            type="number"
            min={1}
            max={30}
            value={adults}
            onChange={(event) => setAdults(event.target.value)}
          />
        </Field>
        <Field label="Children">
          <input
            className={inputClass}
            type="number"
            min={0}
            max={20}
            value={children}
            onChange={(event) => setChildren(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Arriving (optional)">
          <input
            className={inputClass}
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        <Field label="Leaving (optional)">
          <input
            className={inputClass}
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </Field>
      </div>

      {destinationOptions.length > 0 ? (
        <fieldset>
          <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <Users aria-hidden className="h-4 w-4" />
            Places you care about
          </legend>
          <div className="flex flex-wrap gap-2">
            {destinationOptions.slice(0, 24).map((option) => {
              const selected = destinations.includes(option.name);
              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => toggleDestination(option.name)}
                  aria-pressed={selected}
                  className={
                    selected
                      ? "rounded-card border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                      : "rounded-card border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {option.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Interests</legend>
        <div className="flex flex-wrap gap-2">
          {TRIP_INTEREST_VALUES.map((interest) => {
            const selected = interests.includes(interest);
            return (
              <button
                type="button"
                key={interest}
                onClick={() => toggleInterest(interest)}
                aria-pressed={selected}
                className={
                  selected
                    ? "rounded-card border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                    : "rounded-card border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {INTEREST_LABELS[interest]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Budget range (optional)" error={fieldErrors.budgetRange}>
        <select
          className={inputClass}
          value={budgetRange}
          onChange={(event) => setBudgetRange(event.target.value)}
        >
          <option value="">Prefer not to say</option>
          {BUDGET_RANGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Accommodation preferences" hint="Hotel, guesthouse, eco-lodge, camping…">
        <textarea
          className={inputClass}
          rows={2}
          value={accommodationPref}
          onChange={(event) => setAccommodationPref(event.target.value)}
          maxLength={500}
        />
      </Field>

      <Field label="Transport preferences" hint="Private driver, shared transfers, self-drive…">
        <textarea
          className={inputClass}
          rows={2}
          value={transportPref}
          onChange={(event) => setTransportPref(event.target.value)}
          maxLength={500}
        />
      </Field>

      <Field label="Anything else we should know?">
        <textarea
          className={inputClass}
          rows={3}
          value={specialRequests}
          onChange={(event) => setSpecialRequests(event.target.value)}
          maxLength={2000}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? (
            <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send aria-hidden className="mr-2 h-4 w-4" />
          )}
          {pending ? "Sending…" : "Send to the concierge team"}
        </button>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wallet aria-hidden className="h-3.5 w-3.5" />
          No payment here — pricing comes from a person, not a bot.
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail aria-hidden className="h-3.5 w-3.5" />
          Replies by email.
        </span>
      </div>
    </form>
  );
}
