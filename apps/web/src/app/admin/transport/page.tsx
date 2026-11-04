"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Trash2, X } from "lucide-react";
import type { AdminListingRequest } from "@travelghana/types";

import { api, ApiClientError, validationIssues } from "@/lib/api";
import { formatDateTime, FormFeedback, inputClass, secondaryButtonClass } from "@/components/admin/shared";

type StatusFilter = "" | "PENDING" | "CONFIRMED" | "CANCELLED";

const STATUS_OPTIONS: Array<{ value: Exclude<StatusFilter, "">; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_CHIP: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  CONFIRMED: "bg-primary/10 text-primary",
  CANCELLED: "bg-accent/10 text-accent",
};

const actionButtonClass =
  "inline-flex items-center gap-1.5 rounded-card border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted/60 disabled:opacity-50";

/** Which team message the row is writing: a quote, or a confirm/cancel note. */
type WritingKind = "quote" | "confirm" | "cancel";

/**
 * Quote queue for transport listing requests (D43). Travelers asked for a
 * quote - there are no prices in the data, so the quote is the team's written
 * message (emailed to the traveler and kept on the row). A pending request
 * accepts a quote any time; confirm / cancel close the conversation once.
 */
export default function AdminTransportPage() {
  const [items, setItems] = useState<AdminListingRequest[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Row whose message box is open + the kind of message being written. */
  const [writingId, setWritingId] = useState<string | null>(null);
  const [writingKind, setWritingKind] = useState<WritingKind>("quote");
  const [message, setMessage] = useState("");

  const load = useCallback((filter: StatusFilter) => {
    api
      .adminListingRequests((filter || undefined) as "PENDING" | "CONFIRMED" | "CANCELLED" | undefined)
      .then(({ items: next, total: nextTotal }) => {
        setItems(next);
        setTotal(nextTotal);
        setError(null);
      })
      .catch((err) => {
        setItems([]);
        setTotal(null);
        setError(err instanceof Error ? err.message : "Could not load the transport requests.");
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load(status);
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [status, load]);

  function openWriting(row: AdminListingRequest, kind: WritingKind) {
    setWritingId(row.id);
    setWritingKind(kind);
    setMessage(row.quoteNote ?? "");
    setError(null);
  }

  function closeWriting() {
    setWritingId(null);
    setMessage("");
  }

  async function sendAction(row: AdminListingRequest) {
    setBusyId(row.id);
    setError(null);
    try {
      if (writingKind === "quote") {
        if (message.trim().length < 2) {
          setError("Write the quote you want to send to the traveler.");
          setBusyId(null);
          return;
        }
        await api.adminQuoteListingRequest(row.id, message.trim());
        setItems((prev) => (prev ?? []).filter((item) => item.id !== row.id));
        setTotal((prev) => (prev === null ? null : Math.max(0, prev - 1)));
      } else {
        const updated = await api.adminDecideListingRequest(
          row.id,
          writingKind === "confirm" ? "CONFIRMED" : "CANCELLED",
          message.trim() || undefined,
        );
        if (status === "PENDING" || status === "") {
          setItems((prev) => (prev ?? []).filter((item) => item.id !== updated.request.id));
          setTotal((prev) => (prev === null ? null : Math.max(0, prev - 1)));
        } else {
          setItems((prev) => (prev ?? []).map((item) => (item.id === updated.request.id ? updated.request : item)));
        }
      }
      closeWriting();
    } catch (err) {
      if (err instanceof ApiClientError) {
        const issues = validationIssues(err);
        setError(issues[0]?.message ?? err.message);
      } else {
        setError("Network error - is the API running?");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: AdminListingRequest) {
    if (!window.confirm(`Delete transport request ${row.code}? This cannot be undone.`)) return;
    setBusyId(row.id);
    setError(null);
    try {
      await api.adminDeleteListingRequest(row.id);
      setItems((prev) => (prev ?? []).filter((item) => item.id !== row.id));
      setTotal((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 pb-24">
      <div>
        <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
          Admin
        </p>
        <h1 className="animate-rise mt-1 font-display text-3xl [animation-delay:40ms] sm:text-4xl">
          Transport requests
        </h1>
        <p className="animate-rise mt-2 max-w-2xl text-muted-foreground [animation-delay:80ms]">
          Travelers asked these teams for a quote. Reply with your written price - it is emailed
          to the traveler and kept on the row. Confirm or cancel to close the conversation.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <FormFeedback message={error} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {total !== null ? (
          <p aria-live="polite" className="text-sm font-medium">
            {total} {total === 1 ? "request" : "requests"}
          </p>
        ) : null}
        <label className="sm:w-56">
          <span className="sr-only">Filter by status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className={inputClass}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {items === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Loading transport requests...
          </p>
        ) : null}
        {items !== null && items.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No transport requests with this status yet.
          </p>
        ) : null}
        {items?.map((request) => (
          <article
            key={request.id}
            className="rounded-card border border-border bg-card p-5"
            aria-label={`Transport request ${request.code} for ${request.listing.title}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-sm font-semibold">{request.code}</p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CHIP[request.status] ?? "bg-muted text-muted-foreground"}`}
              >
                {request.status.toLowerCase()}
              </span>
            </div>
            {request.notes ? (
              <p className="mt-3 rounded-card bg-muted/50 px-3 py-2 text-sm leading-relaxed text-foreground">
                {request.notes}
              </p>
            ) : (
              <p className="mt-3 text-sm italic text-muted-foreground">No extra details given.</p>
            )}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Service</dt>
                <dd className="mt-0.5 font-medium">
                  {request.listing.title}
                  <span className="block text-xs text-muted-foreground">
                    by {request.listing.provider.name}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Traveler</dt>
                <dd className="mt-0.5 font-medium">
                  {request.user.name ?? "Member"}
                  <span className="text-muted-foreground"> - </span>
                  {request.user.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Travel date + party
                </dt>
                <dd className="mt-0.5 font-medium">{formatDateTime(request.startDate)}</dd>
                <dd className="text-sm text-muted-foreground">
                  {request.partySize} {request.partySize === 1 ? "traveler" : "travelers"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Sent</dt>
                <dd className="mt-0.5 font-medium">{formatDateTime(request.createdAt)}</dd>
              </div>
            </dl>
            {request.quoteNote ? (
              <p className="mt-3 rounded-card border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                Quote on file: {request.quoteNote}
              </p>
            ) : null}
            {request.status !== "PENDING" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Decided {request.decidedAt ? formatDateTime(request.decidedAt) : ""} - the
                conversation is closed, outreach stays possible from the audit trail only.
              </p>
            ) : null}

            {request.status === "PENDING" ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openWriting(request, "quote")}
                  disabled={busyId !== null}
                  className={`${actionButtonClass} border-primary/40 text-primary`}
                >
                  {request.quoteNote ? "Update the quote" : "Send the quote"}
                </button>
                <button
                  type="button"
                  onClick={() => openWriting(request, "confirm")}
                  disabled={busyId !== null}
                  className={`${actionButtonClass} border-primary/40 text-primary`}
                >
                  <Check aria-hidden className="h-3.5 w-3.5" /> Confirm
                </button>
                <button
                  type="button"
                  onClick={() => openWriting(request, "cancel")}
                  disabled={busyId !== null}
                  className={`${actionButtonClass} border-accent/40 text-accent`}
                >
                  <X aria-hidden className="h-3.5 w-3.5" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void remove(request)}
                  disabled={busyId !== null}
                  className={`${actionButtonClass} text-muted-foreground`}
                >
                  {busyId === request.id ? (
                    <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  )}
                  Delete
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void remove(request)}
                  disabled={busyId !== null}
                  className={secondaryButtonClass}
                >
                  <Trash2 aria-hidden className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}

            {writingId === request.id ? (
              <div className="mt-3 rounded-card border border-border bg-muted/30 p-4">
                <label htmlFor={`message-${request.id}`} className="mb-1.5 block text-sm font-medium">
                  {writingKind === "quote"
                    ? "The quote (emailed to the traveler and kept on the row)"
                    : writingKind === "confirm"
                      ? "Anything the traveler should know? (optional, emailed)"
                      : "Why is this request cancelled? (optional, emailed)"}
                </label>
                <textarea
                  id={`message-${request.id}`}
                  rows={5}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className={inputClass}
                  placeholder={
                    writingKind === "quote"
                      ? "e.g. Round trip Accra - Cape Coast for 4: GHS 1400 incl. driver and fuel. Payment by Mobile Money on pickup."
                      : writingKind === "confirm"
                        ? "e.g. Confirmed - the driver will meet you at Arrivals at 14:00."
                        : "e.g. No vehicle available on that date."
                  }
                />
                {writingKind === "quote" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Quotes are freeform - this platform records no prices, so write the full
                    offer you want the traveler to see.
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void sendAction(request)}
                    disabled={busyId !== null}
                    className={`${actionButtonClass} border-primary/40 text-primary`}
                  >
                    {busyId === request.id ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {writingKind === "quote"
                      ? "Send quote"
                      : writingKind === "confirm"
                        ? "Confirm request"
                        : "Cancel request"}
                  </button>
                  <button
                    type="button"
                    onClick={closeWriting}
                    disabled={busyId !== null}
                    className={secondaryButtonClass}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  );
}
