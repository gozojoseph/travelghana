"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, LogIn, Send } from "lucide-react";
import type { PackageBooking, PackageDepartureDto } from "@travelghana/types";
import { packageBookingCreateSchema } from "@travelghana/validation";

import { api } from "@/lib/api";
import { trackEvent } from "@/lib/tracking";
import {
  buttonClass,
  Field,
  FormFeedback,
  inputClass,
  issueMap,
} from "@/components/admin/shared";

type Phase = "checking" | "anonymous" | "form" | "done";

/** Earliest date the date input allows (yesterday guard for timezones). */
const TODAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Departure dates are UTC midnights; label them consistently (D41). */
function formatDepartureDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Booking requests for a published package (D25). A signed-in traveler fills the
 * form; an anonymous visitor sees "Book now" and is sent to /login with a
 * next= back to this exact package - signing in returns them straight here.
 * Nothing is charged: the request is only recorded (status PENDING_PAYMENT)
 * until the team confirms availability.
 */
export function BookingPanel({ packageId, slug }: { packageId: string; slug: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [startDate, setStartDate] = useState("");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<PackageBooking | null>(null);
  const [pending, setPending] = useState(false);

  // Set-date journeys (D41): future departures with seats left. An empty list
  // means the package is open-dated and the free date input stays. A failed
  // load degrades to the free-date input; the server still enforces the
  // departure rule (DEPARTURE_REQUIRED) if this package is set-dated.
  const [departures, setDepartures] = useState<PackageDepartureDto[] | null>(null);
  const [departureId, setDepartureId] = useState("");

  useEffect(() => {
    let active = true;
    api
      .me()
      .then(({ user }) => {
        if (active) setPhase(user ? "form" : "anonymous");
      })
      .catch(() => {
        // No session -> start from the anonymous state.
        if (active) setPhase("anonymous");
      });
    // Departure availability is public - load it either way so the form is
    // ready the moment a visitor signs in.
    api
      .packageDepartures(slug)
      .then((res) => {
        if (active) setDepartures(res.departures);
      })
      .catch(() => {
        if (active) setDepartures([]);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  // Funnel milestone (D37): a signed-in visitor looking at the booking form.
  useEffect(() => {
    if (phase === "form") trackEvent("booking_started", { source: "form" });
  }, [phase]);

  async function submit() {
    const parsed = packageBookingCreateSchema.safeParse({
      packageId,
      startDate,
      adults,
      children,
      notes: notes.trim(),
      ...(departureId ? { departureId } : {}),
    });
    if (!parsed.success) {
      setFieldErrors(issueMap(parsed.error.issues));
      setError("Please fix the highlighted fields.");
      return;
    }
    setFieldErrors({});
    setError(null);
    setPending(true);
    try {
      // Send the pre-transform wire shape: startDate stays the "YYYY-MM-DD"
      // string the server validates; parsed.data would carry a Date object
      // that JSON-serializes into an ISO datetime the API rejects (D25 fix).
      const { booking: created } = await api.createBooking({
        packageId,
        startDate,
        adults: Number(adults),
        children: Number(children),
        notes: notes.trim(),
        ...(departureId ? { departureId } : {}),
      });
      trackEvent("booking_created", { code: created.code });
      setBooking(created);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the booking request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Ready to go?
      </p>

      {phase === "checking" ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : null}

      {/* Anonymous visitor: login first, then we bring them straight back. */}
      {phase === "anonymous" ? (
        <div className="mt-2">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Booking requests are reviewed by our team before your trip is confirmed.
            You are not charged anything now.
          </p>
          <button
            type="button"
            onClick={() => {
              trackEvent("booking_started", { source: "book-now" });
              router.push(`/login?next=${encodeURIComponent(`/packages/${slug}`)}`);
            }}
            className={`${buttonClass} mt-4 inline-flex w-full items-center justify-center gap-2`}
          >
            <LogIn aria-hidden className="h-4 w-4" /> Book now
          </button>
          <p className="mt-2 text-xs text-muted-foreground">You will sign in first.</p>
        </div>
      ) : null}

      {/* Signed in: the booking form. */}
      {phase === "form" ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="mt-3"
        >
          <div className="flex flex-col gap-4">
            {departures !== null && departures.length > 0 ? (
              <Field
                label="Departure date"
                hint="This journey runs on set dates - the seats left are shown per date."
                error={fieldErrors.startDate}
              >
                <select
                  value={departureId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDepartureId(next);
                    const chosen = departures.find((dep) => dep.id === next);
                    // The chosen departure fixes the start date the API sees.
                    setStartDate(chosen ? chosen.date : "");
                  }}
                  className={inputClass}
                >
                  <option value="">Choose a departure…</option>
                  {departures.map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {formatDepartureDate(dep.date)} · {dep.remaining}{" "}
                      {dep.remaining === 1 ? "seat left" : "seats left"}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Start date" error={fieldErrors.startDate}>
                <input
                  type="date"
                  value={startDate}
                  min={TODAY}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={inputClass}
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Adults" error={fieldErrors.adults}>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={adults}
                  onChange={(event) => setAdults(event.target.value)}
                  className={inputClass}
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
                />
              </Field>
            </div>
            <Field label="Notes (optional)" hint="Anything the team should know." error={fieldErrors.notes}>
              <textarea
                value={notes}
                rows={3}
                onChange={(event) => setNotes(event.target.value)}
                className={inputClass}
                placeholder="e.g. window seats, dietary requirements"
              />
            </Field>
          </div>
          <button
            type="submit"
            disabled={pending}
            className={`${buttonClass} mt-4 inline-flex w-full items-center justify-center gap-2`}
          >
            {pending ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Send aria-hidden className="h-4 w-4" />
            )}
            {pending ? "Sending…" : "Send booking request"}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            No charge now - our team confirms availability first.
          </p>
        </form>
      ) : null}

      {/* Success: show the human booking reference. */}
      {phase === "done" && booking ? (
        <div role="status" className="animate-pop mt-3 rounded-card border border-primary/20 bg-primary/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <CalendarDays aria-hidden className="h-4 w-4" />
            Booking request {booking.code} received
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            No payment has been taken. Our team will confirm availability and
            follow up with next steps.
          </p>
        </div>
      ) : null}

      <div className="mt-3">
        <FormFeedback message={error} />
      </div>
    </div>
  );
}
