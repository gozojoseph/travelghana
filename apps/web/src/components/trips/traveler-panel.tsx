"use client";

import { FormEvent, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import type { NeedCategory, TripDetail, TripTraveler } from "@travelghana/types";
import { travelerCreateSchema, travelerUpdateSchema } from "@travelghana/validation";

import { tripsSource } from "@/lib/trips";

import {
  buttonClass,
  Field,
  FormFeedback,
  inputClass,
  issueMap,
  NEED_CATEGORIES,
  NEED_CATEGORY_LABELS,
  secondaryButtonClass,
} from "./shared";

interface NeedDraft {
  category: NeedCategory;
  details: string;
}

const EMPTY_NEEDS: NeedDraft[] = [];

/** Travelers + sensitive needs (§11) — owner-only in Phase A. */
export function TravelerPanel({
  trip,
  onChange,
}: {
  trip: TripDetail;
  onChange: (trip: TripDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TripTraveler | null>(null);
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [needs, setNeeds] = useState<NeedDraft[]>(EMPTY_NEEDS);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function openAdd() {
    setEditing(null);
    setName("");
    setAgeGroup("");
    setNeeds([]);
    setFormError(null);
    setFieldErrors({});
    setOpen(true);
  }

  function openEdit(traveler: TripTraveler) {
    setEditing(traveler);
    setName(traveler.name ?? "");
    setAgeGroup(traveler.ageGroup ?? "");
    setNeeds(
      traveler.needs.map((need) => ({ category: need.category, details: need.details ?? "" })),
    );
    setFormError(null);
    setFieldErrors({});
    setOpen(true);
  }

  function updateNeed(index: number, patch: Partial<NeedDraft>) {
    setNeeds((current) =>
      current.map((need, i) => (i === index ? { ...need, ...patch } : need)),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const payload = {
      name: name.trim() || null,
      ageGroup: ageGroup.trim() || null,
      needs: needs.map((need) => ({
        category: need.category,
        details: need.details.trim() || null,
      })),
    };

    setPending(true);
    try {
      if (editing) {
        const parsed = travelerUpdateSchema.safeParse(payload);
        if (!parsed.success) {
          setFieldErrors(issueMap(parsed.error.issues));
          setPending(false);
          return;
        }
        onChange(await tripsSource.updateTraveler(trip.id, editing.id, parsed.data));
      } else {
        const parsed = travelerCreateSchema.safeParse(payload);
        if (!parsed.success) {
          setFieldErrors(issueMap(parsed.error.issues));
          setPending(false);
          return;
        }
        onChange(await tripsSource.addTraveler(trip.id, parsed.data));
      }
      setPending(false);
      setOpen(false);
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the traveler");
      setPending(false);
    }
  }

  async function removeTraveler(traveler: TripTraveler) {
    const label = traveler.name ?? "this traveler";
    if (!window.confirm(`Remove ${label} from the trip?`)) return;
    try {
      onChange(await tripsSource.removeTraveler(trip.id, traveler.id));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not remove the traveler");
    }
  }

  const needError = Object.entries(fieldErrors).find(([key]) => key.startsWith("needs"))?.[1];

  return (
    <section className="rounded-card border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl">Travelers</h2>
        <button type="button" onClick={openAdd} className={secondaryButtonClass}>
          <UserPlus aria-hidden className="mr-1.5 inline h-4 w-4" />
          Add traveler
        </button>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Accessibility, dietary and medical needs stay private to you for now — providers will only
        see what you explicitly allow once sharing ships.
      </p>

      {trip.travelers.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No traveler details yet. The party size above is enough to plan, but adding names and needs
          helps us tailor the itinerary.
        </p>
      ) : (
        <ul className="tg-stagger mt-4 flex flex-col gap-3">
          {trip.travelers.map((traveler) => (
            <li
              key={traveler.id}
              className="flex flex-col gap-2 rounded-card border border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="font-medium">
                  {traveler.name ?? "Unnamed traveler"}
                  {traveler.ageGroup ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {traveler.ageGroup}
                    </span>
                  ) : null}
                </p>
                {traveler.needs.length > 0 ? (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {traveler.needs.map((need) => (
                      <li
                        key={need.id}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                        title={need.details ?? undefined}
                      >
                        {NEED_CATEGORY_LABELS[need.category]}
                        {need.details ? `: ${need.details}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(traveler)}
                  className="rounded-card border border-border p-2 text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-90"
                  aria-label={`Edit ${traveler.name ?? "traveler"}`}
                >
                  <Pencil aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void removeTraveler(traveler)}
                  className="rounded-card border border-border p-2 text-muted-foreground transition-[color,transform] duration-150 hover:text-accent active:scale-90"
                  aria-label={`Remove ${traveler.name ?? "traveler"}`}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form
          onSubmit={onSubmit}
          className="animate-pop mt-5 flex flex-col gap-4 rounded-card border border-border bg-muted/40 p-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={fieldErrors.name}>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Esi Mensah"
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.name)}
              />
            </Field>
            <Field label="Age group" error={fieldErrors.ageGroup} hint="e.g. Child, Adult, Senior.">
              <input
                type="text"
                value={ageGroup}
                onChange={(event) => setAgeGroup(event.target.value)}
                placeholder="Child"
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.ageGroup)}
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Needs</span>
              <button
                type="button"
                onClick={() => setNeeds((current) => [...current, { category: "DIETARY", details: "" }])}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 transition-transform duration-150 hover:underline active:scale-95"
              >
                <Plus aria-hidden className="h-3.5 w-3.5" />
                Add need
              </button>
            </div>
            {needs.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Optional — accessibility, dietary, medical or other support.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {needs.map((need, index) => (
                  <li key={index} className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={need.category}
                      onChange={(event) =>
                        updateNeed(index, { category: event.target.value as NeedCategory })
                      }
                      className={`${inputClass} sm:w-48`}
                      aria-label="Need category"
                    >
                      {NEED_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {NEED_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={need.details}
                      onChange={(event) => updateNeed(index, { details: event.target.value })}
                      placeholder="Details (visible to you only)"
                      className={inputClass}
                      aria-label="Need details"
                    />
                    <button
                      type="button"
                      onClick={() => setNeeds((current) => current.filter((_, i) => i !== index))}
                      className="self-start rounded-card border border-border p-3 text-muted-foreground transition-[color,transform] duration-150 hover:text-accent active:scale-90 sm:self-auto"
                      aria-label="Remove need"
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {needError ? <p className="mt-1 text-xs text-red-600">{needError}</p> : null}
          </div>

          <FormFeedback message={formError} />

          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className={buttonClass}>
              {pending ? <Loader2 aria-hidden className="mr-2 inline h-4 w-4 animate-spin" /> : null}
              {editing ? "Save traveler" : "Add traveler"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
