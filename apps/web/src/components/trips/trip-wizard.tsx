"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  Loader2,
  LogIn,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import type {
  BudgetTier,
  BudgetType,
  TravelPace,
  TripDestinationOption,
  TripInterest,
} from "@travelghana/types";
import {
  BUDGET_TIER_VALUES,
  BUDGET_TYPE_VALUES,
  TRAVEL_PACE_VALUES,
  TRIP_INTEREST_VALUES,
  tripCreateSchema,
} from "@travelghana/validation";

import { ApiClientError, api } from "@/lib/api";
import { toMinorUnits } from "@/lib/format";
import { isDemoTrips, tripsSource } from "@/lib/trips";
import { formatDateRange } from "@/lib/trips/date";
import {
  clearDraft,
  draftHasContent,
  readDraft,
  writeDraft,
  type WizardDraft,
} from "@/lib/trips/draft-store";

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
  TRAVEL_PACE_HINTS,
  TRAVEL_PACE_LABELS,
} from "./shared";

const STEP_LABELS = ["Basics", "Dates & travelers", "Your style", "Review"] as const;

export function TripWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [budget, setBudget] = useState("");
  const [budgetType, setBudgetType] = useState<BudgetType>("PER_GROUP");
  const [budgetTier, setBudgetTier] = useState<BudgetTier>("FLEXIBLE");
  const [budgetIncludesFlights, setBudgetIncludesFlights] = useState(false);
  const [interests, setInterests] = useState<TripInterest[]>([]);
  const [travelPace, setTravelPace] = useState<TravelPace>("BALANCED");
  const [arrivalPoint, setArrivalPoint] = useState("");
  const [destinationPreferences, setDestinationPreferences] = useState<string[]>([]);
  const [destinationOptions, setDestinationOptions] = useState<TripDestinationOption[]>([]);
  const [notes, setNotes] = useState("");
  const [session, setSession] = useState<"checking" | "authenticated" | "guest">(
    isDemoTrips ? "authenticated" : "checking",
  );
  const [restored, setRestored] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    // Restored from a microtask so the first committed render matches the
    // server output (session storage is client-only), while the draft still
    // appears before the user can interact.
    void Promise.resolve().then(() => {
      if (!active) return;
      const draft = readDraft();
      if (!draft) return;
      setStep(Math.min(Math.max(draft.step, 0), 3));
      setName(draft.name);
      setStartDate(draft.startDate);
      setEndDate(draft.endDate);
      setAdults(draft.adults);
      setChildren(draft.children);
      setBudget(draft.budget);
      setBudgetType(draft.budgetType);
      setBudgetTier(draft.budgetTier);
      setBudgetIncludesFlights(draft.budgetIncludesFlights);
      setInterests(draft.interests);
      setTravelPace(draft.travelPace);
      setArrivalPoint(draft.arrivalPoint);
      setDestinationPreferences(draft.destinationPreferences);
      setNotes(draft.notes);
      setRestored(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    tripsSource
      .destinations()
      .then((options) => {
        if (active) setDestinationOptions(options);
      })
      .catch(() => {
        // The optional place preference degrades to empty.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isDemoTrips) return;
    let active = true;
    api
      .me()
      .then(() => {
        if (active) setSession("authenticated");
      })
      .catch(() => {
        if (active) setSession("guest");
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

  function draft(): WizardDraft {
    return {
      step,
      name,
      startDate,
      endDate,
      adults,
      children,
      budget,
      budgetType,
      budgetTier,
      budgetIncludesFlights,
      interests,
      travelPace,
      arrivalPoint,
      destinationPreferences,
      notes,
    };
  }

  /** Keeps the on-device draft in step with wizard navigation (Phase 2). */
  function persistDraft(nextStep: number) {
    const target = { ...draft(), step: nextStep };
    if (draftHasContent(target)) writeDraft(target);
  }

  function continueStep(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setFieldErrors({});

    if (step === 1) {
      if (endDate && !startDate) {
        setFieldErrors({ startDate: "Add a start date before the end date" });
        return;
      }
      if (startDate && endDate && endDate < startDate) {
        setFieldErrors({ endDate: "The end date must be on or after the start date" });
        return;
      }
    }

    const next = Math.min(step + 1, STEP_LABELS.length - 1);
    persistDraft(next);
    setStep(next);
  }

  function buildPayload() {
    let budgetMinor: number | null = null;
    if (budget.trim() !== "") {
      const parsed = Number.parseFloat(budget);
      if (Number.isFinite(parsed)) budgetMinor = toMinorUnits(budget);
    }

    return {
      name: name.trim() || "My Ghana trip",
      startDate: startDate || null,
      endDate: endDate || null,
      adults: Number.parseInt(adults, 10) || 1,
      children: Number.parseInt(children, 10) || 0,
      budgetMinor,
      currencyCode: "GHS",
      notes: notes.trim() || null,
      interests,
      travelPace,
      budgetTier,
      budgetType,
      budgetIncludesFlights,
      arrivalPoint: arrivalPoint.trim() || null,
      destinationPreferences,
    };
  }

  function stepForField(field: string | number | undefined): number {
    if (field === "name") return 0;
    if (
      field === "startDate" ||
      field === "endDate" ||
      field === "adults" ||
      field === "children" ||
      field === "arrivalPoint" ||
      field === "destinationPreferences"
    ) {
      return 1;
    }
    return 2;
  }

  async function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < STEP_LABELS.length - 1) {
      continueStep();
      return;
    }
    setFormError(null);
    setFieldErrors({});

    const parsed = tripCreateSchema.safeParse(buildPayload());
    if (!parsed.success) {
      setFieldErrors(issueMap(parsed.error.issues));
      const targetStep = stepForField(parsed.error.issues[0]?.path[0]);
      persistDraft(targetStep);
      setStep(targetStep);
      return;
    }

    if (session === "guest") {
      writeDraft(draft());
      window.location.href = "/login?next=%2Fplan-my-trip";
      return;
    }

    setPending(true);
    try {
      const trip = await tripsSource.create(parsed.data);
      clearDraft();
      router.push(`/trips/${trip.id}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setSession("guest");
        writeDraft(draft());
        window.location.href = "/login?next=%2Fplan-my-trip";
        return;
      }
      setFormError(error instanceof Error ? error.message : "Could not create the trip");
      setPending(false);
    }
  }

  const selectedPlaces = destinationPreferences
    .map((id) => destinationOptions.find((option) => option.id === id)?.name)
    .filter((value): value is string => Boolean(value));

  return (
    <section
      aria-labelledby="wizard-heading"
      className="rounded-card border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-secondary">
            Personalized setup
          </p>
          <h2 id="wizard-heading" className="mt-1 font-display text-2xl">
            Build your trip brief
          </h2>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          Step {step + 1} of {STEP_LABELS.length}
        </span>
      </div>

      <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Planner steps">
        {STEP_LABELS.map((label, index) => (
          <li key={label} aria-current={index === step ? "step" : undefined}>
            <div
              className={`h-1 rounded-full transition-colors duration-200 ${
                index <= step ? "bg-primary" : "bg-muted"
              }`}
              aria-hidden
            />
            <span
              className={`mt-1 block truncate text-[10px] font-medium ${
                index === step ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {restored ? (
        <p
          role="status"
          className="mt-4 rounded-card border border-secondary/60 bg-secondary/15 px-3 py-2 text-xs"
        >
          Your draft was restored. Finish saving it by creating the trip.
        </p>
      ) : null}

      {session === "guest" ? (
        <p className="mt-4 flex items-start gap-2 rounded-card border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <LogIn aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          You can plan without an account. When you create the trip we&apos;ll ask you to sign in,
          then bring you back to your draft.
        </p>
      ) : null}

      <FormFeedback message={formError} />

      <form onSubmit={createTrip} className="mt-5 flex flex-col gap-5" noValidate>
        {step === 0 ? (
          <div className="animate-pop flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles aria-hidden className="h-4 w-4 text-primary" />
              Start with the name — everything else can change later.
            </div>
            <Field
              label="Trip name"
              error={fieldErrors.name}
              hint="Optional. We'll call it “My Ghana trip” if you leave it blank."
            >
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Cape Coast heritage weekend"
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.name)}
              />
            </Field>
            <Field label="Notes" error={fieldErrors.notes} hint="Optional.">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="What matters most to you on this trip?"
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.notes)}
              />
            </Field>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="animate-pop flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays aria-hidden className="h-4 w-4 text-primary" />
              Dates generate one itinerary day per calendar day. Leave them blank if you&apos;re
              still deciding.
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date" error={fieldErrors.startDate} hint="Optional.">
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={inputClass}
                  aria-invalid={Boolean(fieldErrors.startDate)}
                />
              </Field>
              <Field label="End date" error={fieldErrors.endDate} hint="Optional.">
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
                  placeholder="Kotoka Airport (ACC)"
                  className={inputClass}
                  aria-invalid={Boolean(fieldErrors.arrivalPoint)}
                />
              </Field>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Places you want to include</legend>
              <p className="mb-2 text-xs text-muted-foreground">
                Optional — this keeps your brief, it does not reserve anything.
              </p>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-card border border-border p-2">
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
                    Places are unavailable right now — you can still continue.
                  </span>
                ) : null}
              </div>
            </fieldset>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="animate-pop flex flex-col gap-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet aria-hidden className="h-4 w-4 text-primary" />
              This shapes suggestions and budget checks — it is not a payment.
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

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Budget style</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {BUDGET_TIER_VALUES.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setBudgetTier(tier)}
                    aria-pressed={budgetTier === tier}
                    className={`rounded-card border p-3 text-left transition-[border-color,background-color] duration-150 ${
                      budgetTier === tier
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="block text-sm font-medium">
                      {BUDGET_TIER_LABELS[tier]}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {BUDGET_TIER_HINTS[tier]}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Travel pace</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {TRAVEL_PACE_VALUES.map((pace) => (
                  <button
                    key={pace}
                    type="button"
                    onClick={() => setTravelPace(pace)}
                    aria-pressed={travelPace === pace}
                    className={`rounded-card border p-3 text-left transition-[border-color,background-color] duration-150 ${
                      travelPace === pace
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="block text-sm font-medium">
                      {TRAVEL_PACE_LABELS[pace]}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {TRAVEL_PACE_HINTS[pace]}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Interests</legend>
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
          </div>
        ) : null}

        {step === 3 ? (
          <div className="animate-pop flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check aria-hidden className="h-4 w-4 text-primary" />
              One last look. You can change everything after the trip is created.
            </div>

            <dl className="divide-y divide-border rounded-card border border-border">
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <dt className="text-sm text-muted-foreground">Trip</dt>
                <dd className="text-right text-sm font-medium">{name.trim() || "My Ghana trip"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <dt className="text-sm text-muted-foreground">Dates</dt>
                <dd className="text-right text-sm">{formatDateRange(startDate || null, endDate || null)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users aria-hidden className="h-3.5 w-3.5" /> Travelers
                </dt>
                <dd className="text-right text-sm">
                  {adults} {Number.parseInt(adults, 10) === 1 ? "adult" : "adults"}
                  {Number.parseInt(children, 10) > 0
                    ? ` · ${children} ${Number.parseInt(children, 10) === 1 ? "child" : "children"}`
                    : ""}
                </dd>
              </div>
              {arrivalPoint.trim() ? (
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <dt className="text-sm text-muted-foreground">Arrival</dt>
                  <dd className="text-right text-sm">{arrivalPoint.trim()}</dd>
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <dt className="text-sm text-muted-foreground">Style</dt>
                <dd className="text-right text-sm">
                  {TRAVEL_PACE_LABELS[travelPace]} · {BUDGET_TIER_LABELS[budgetTier]} ·{" "}
                  {budgetIncludesFlights ? "flights included" : "flights excluded"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <dt className="text-sm text-muted-foreground">Budget</dt>
                <dd className="text-right text-sm">
                  {budget.trim() ? `GHS ${budget.trim()}` : "Not set"} ·{" "}
                  {BUDGET_TYPE_LABELS[budgetType].toLowerCase()}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <BedDouble aria-hidden className="h-3.5 w-3.5" /> Sleep
                </dt>
                <dd className="max-w-[60%] text-right text-sm">
                  Decided in the itinerary after this step — one Stay per night, or leave nights
                  open.
                </dd>
              </div>
              {selectedPlaces.length > 0 ? (
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <dt className="text-sm text-muted-foreground">Places</dt>
                  <dd className="text-right text-sm">{selectedPlaces.join(", ")}</dd>
                </div>
              ) : null}
              {interests.length > 0 ? (
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <dt className="text-sm text-muted-foreground">Interests</dt>
                  <dd className="text-right text-sm">
                    {interests.map((interest) => INTEREST_LABELS[interest]).join(", ")}
                  </dd>
                </div>
              ) : null}
            </dl>

            <p className="text-xs text-muted-foreground">
              Creating a trip saves your plan. It does not book, reserve or charge anything.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            {step > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setFieldErrors({});
                  const next = Math.max(0, step - 1);
                  persistDraft(next);
                  setStep(next);
                }}
                className="inline-flex items-center gap-1.5 rounded-card border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-[0.98]"
              >
                <ArrowLeft aria-hidden className="h-4 w-4" />
                Back
              </button>
            ) : null}
          </div>

          {step < STEP_LABELS.length - 1 ? (
            <button type="button" onClick={() => continueStep()} className={buttonClass}>
              Continue
              <ArrowRight aria-hidden className="ml-2 inline h-4 w-4" />
            </button>
          ) : (
            <button type="submit" disabled={pending || session === "checking"} className={buttonClass}>
              {pending ? (
                <Loader2 aria-hidden className="mr-2 inline h-4 w-4 animate-spin" />
              ) : session === "guest" ? (
                <LogIn aria-hidden className="mr-2 inline h-4 w-4" />
              ) : null}
              {session === "guest" ? "Sign in & save trip" : "Create my trip"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
