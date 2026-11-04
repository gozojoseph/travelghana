"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, Send, Wallet } from "lucide-react";
import type { ListingRequest } from "@travelghana/types";
import { listingRequestCreateSchema } from "@travelghana/validation";

import { api } from "@/lib/api";
import { trackEvent } from "@/lib/tracking";
import { buttonClass, Field, FormFeedback, inputClass, issueMap } from "@/components/admin/shared";

type Phase = "checking" | "anonymous" | "form" | "done";

/** Earliest date the date input allows (yesterday guard for timezones). */
const TODAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Quote-only transport requests (D43). A signed-in traveler fills the form;
 * an anonymous visitor is sent to /login with a next= back to this listing.
 * There is no price anywhere: the team replies with a written quote by email.
 */
export function RequestQuotePanel({
  listingId,
  providerSlug,
  listingSlug,
}: {
  listingId: string;
  providerSlug: string;
  listingSlug: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [startDate, setStartDate] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<ListingRequest | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then(({ user }) => {
        if (active) setPhase(user ? "form" : "anonymous");
      })
      .catch(() => {
        if (active) setPhase("anonymous");
      });
    return () => {
      active = false;
    };
  }, []);

  // Funnel milestone (D37): a signed-in visitor looking at the quote form.
  useEffect(() => {
    if (phase === "form") trackEvent("transport_request_started", { source: "form" });
  }, [phase]);

  async function submit() {
    const parsed = listingRequestCreateSchema.safeParse({
      listingId,
      startDate,
      partySize,
      notes: notes.trim(),
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
      // string the server validates (same as the package booking form).
      const { request: created } = await api.createListingRequest({
        listingId,
        startDate,
        partySize: Number(partySize),
        notes: notes.trim(),
      });
      trackEvent("transport_request_sent", { code: created.code });
      setRequest(created);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Request a quote
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
            Tell us your travel date and party. Our team replies with a written quote -
            nothing is booked or charged by this form.
          </p>
          <button
            type="button"
            onClick={() => {
              trackEvent("transport_request_started", { source: "request-quote" });
              router.push(
                `/login?next=${encodeURIComponent(`/transport/${providerSlug}/${listingSlug}`)}`,
              );
            }}
            className={`${buttonClass} mt-4 inline-flex w-full items-center justify-center gap-2`}
          >
            <LogIn aria-hidden className="h-4 w-4" /> Request a quote
          </button>
          <p className="mt-2 text-xs text-muted-foreground">You will sign in first.</p>
        </div>
      ) : null}

      {phase === "form" ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="mt-3 flex flex-col gap-4"
        >
          <Field label="Travel date" error={fieldErrors.startDate}>
            <input
              type="date"
              value={startDate}
              min={TODAY}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field
            label="How many travelers?"
            hint="For parties above 40 the team plans with you directly."
            error={fieldErrors.partySize}
          >
            <input
              type="number"
              min={1}
              max={40}
              inputMode="numeric"
              value={partySize}
              onChange={(event) => setPartySize(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field
            label="Pickup, drop-off, anything else?"
            hint="Optional - the more detail, the sharper the quote."
            error={fieldErrors.notes}
          >
            <textarea
              value={notes}
              rows={4}
              onChange={(event) => setNotes(event.target.value)}
              className={inputClass}
              placeholder="e.g. Flight AK-123 lands 14:20, 5 bags, one child seat"
            />
          </Field>
          <button type="submit" disabled={pending} className={`${buttonClass} inline-flex items-center justify-center gap-2`}>
            {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Send aria-hidden className="h-4 w-4" />}
            {pending ? "Sending…" : "Request a quote"}
          </button>
          <FormFeedback message={error} />
        </form>
      ) : null}

      {phase === "done" && request ? (
        <div className="mt-3 rounded-card border border-primary/20 bg-primary/5 p-4">
          <p className="flex items-center gap-2 font-medium text-primary">
            <Wallet aria-hidden className="h-4 w-4" /> Request sent
          </p>
          <p className="mt-2 font-mono text-sm font-semibold">{request.code}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your reference. We emailed you a copy; watch your mailbox - the team replies with a
            quote first, and you decide from there. Nothing is booked or charged yet.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            You can always re-read your requests and any quotes on your account page.
          </p>
        </div>
      ) : null}
    </div>
  );
}
