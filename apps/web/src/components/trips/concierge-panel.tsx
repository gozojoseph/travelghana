"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ConciergeBell, Loader2, Send } from "lucide-react";
import type { TripDetail } from "@travelghana/types";

import { ApiClientError, api } from "@/lib/api";
import { createEnquiry } from "@/lib/enquiries";
import { trackEvent } from "@/lib/tracking";
import { isDemoTrips } from "@/lib/trips";
import { formatDateOnly } from "@/lib/trips/date";
import {
  buttonClass,
  Field,
  FormFeedback,
  inputClass,
  secondaryButtonClass,
} from "./shared";

/**
 * The honest handoff from the planner to the concierge team (D6). It links
 * the *saved* trip to the enquiry — dates, party size, destinations and
 * interests are snapshotted server-side, and nothing is promised beyond a
 * human reply by email. No booking is implied.
 */
export function ConciergePanel({ trip }: { trip: TripDetail }) {
  const [contact, setContact] = useState<{ name: string; email: string } | null | undefined>(
    isDemoTrips ? null : undefined, // undefined = not loaded yet
  );
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accommodationPref, setAccommodationPref] = useState("");
  const [transportPref, setTransportPref] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoTrips || contact !== undefined) return;
    let active = true;
    void api
      .me()
      .then(({ user }) => {
        if (!active) return;
        setContact({ name: user.name ?? "", email: user.email });
        setName(user.name ?? "");
        setEmail(user.email);
      })
      .catch(() => {
        if (active) setContact(null);
      });
    return () => {
      active = false;
    };
  }, [contact]);

  if (isDemoTrips) {
    return (
      <section className="rounded-card border border-dashed border-border bg-card px-5 py-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <ConciergeBell aria-hidden className="h-4 w-4 text-primary" />
          Concierge
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Preview mode: this trip lives only in your browser, so the concierge team cannot see it
          yet. Once you sign in and save plans here, you can send them over — or describe your
          trip on the{" "}
          <Link href="/enquire" className="font-semibold text-primary underline underline-offset-2">
            concierge form
          </Link>
          .
        </p>
      </section>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (name.trim().length < 2 || email.trim() === "") {
      setFieldErrors({
        ...(name.trim().length < 2 ? { name: "Add the name the reply should be addressed to" } : {}),
        ...(email.trim() === "" ? { email: "Add an email so the concierge can respond" } : {}),
      });
      return;
    }

    setPending(true);
    try {
      const { enquiry } = await createEnquiry({
        tripId: trip.id,
        name: name.trim(),
        email: email.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(accommodationPref.trim() ? { accommodationPref: accommodationPref.trim() } : {}),
        ...(transportPref.trim() ? { transportPref: transportPref.trim() } : {}),
        ...(specialRequests.trim() ? { specialRequests: specialRequests.trim() } : {}),
      });
      trackEvent("enquiry_created", { code: enquiry.code, trip: trip.id });
      setReference(enquiry.code);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/trips/${trip.id}`)}`;
        return;
      }
      setFormError(error instanceof Error ? error.message : "Could not send the enquiry");
      setPending(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-card px-5 py-4">
      {reference ? (
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <CheckCircle2 aria-hidden className="h-4 w-4 text-primary" />
            Concierge enquiry sent
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Reference <span className="font-mono font-semibold text-foreground">{reference}</span>.
            A concierge will answer by email with questions or a quote. This enquiry is attached to
            &ldquo;{trip.name}&rdquo; but is <span className="font-semibold">not a booking</span> —
            nothing is charged.
          </p>
        </div>
      ) : (
        <>
          <h3 className="flex items-center gap-2 font-semibold">
            <ConciergeBell aria-hidden className="h-4 w-4 text-primary" />
            Concierge
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Want us to sort the tricky parts? Send this plan to our concierge team — they reply by
            email with questions or a quote.
          </p>

          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={`${buttonClass} mt-3 w-full`}
            >
              <Send aria-hidden className="mr-2 inline h-4 w-4" />
              Send this trip to the concierge
            </button>
          ) : (
            <form onSubmit={submit} noValidate className="animate-pop mt-3 space-y-3">
              <FormFeedback message={formError} />
              <p className="rounded-card bg-muted px-3 py-2 text-xs text-muted-foreground">
                We include the trip brief: {formatDateOnly(trip.startDate)} –{" "}
                {formatDateOnly(trip.endDate)} · {trip.adults}{" "}
                {trip.adults === 1 ? "adult" : "adults"}
                {trip.children > 0 ? ` · ${trip.children} children` : ""} · your saved places and
                interests. Your notes and budget stay private unless you tell them below.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" error={fieldErrors.name}>
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
              <Field label="Phone (optional)">
                <input
                  className={inputClass}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                  maxLength={30}
                />
              </Field>
              <Field label="Stay preferences (optional)">
                <textarea
                  className={inputClass}
                  rows={2}
                  value={accommodationPref}
                  onChange={(event) => setAccommodationPref(event.target.value)}
                  maxLength={500}
                />
              </Field>
              <Field label="Transport preferences (optional)">
                <textarea
                  className={inputClass}
                  rows={2}
                  value={transportPref}
                  onChange={(event) => setTransportPref(event.target.value)}
                  maxLength={500}
                />
              </Field>
              <Field label="Anything to flag to the concierge?">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={specialRequests}
                  onChange={(event) => setSpecialRequests(event.target.value)}
                  maxLength={2000}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <button type="submit" className={buttonClass} disabled={pending}>
                  {pending ? (
                    <Loader2 aria-hidden className="mr-2 inline h-4 w-4 animate-spin" />
                  ) : (
                    <Send aria-hidden className="mr-2 inline h-4 w-4" />
                  )}
                  {pending ? "Sending…" : "Send enquiry"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {contact === null ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Not signed in? This sends after you{" "}
              <Link
                href={`/login?next=${encodeURIComponent(`/trips/${trip.id}`)}`}
                className="font-semibold text-primary underline underline-offset-2"
              >
                sign in again
              </Link>
              .
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
