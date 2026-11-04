"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Inbox,
  Loader2,
  MapPin,
  Search,
  Trash2,
  Users,
  UserCheck,
} from "lucide-react";
import type { Enquiry, EnquiryStatus, SessionUser } from "@travelghana/types";
import { ENQUIRY_STATUS_TRANSITIONS } from "@travelghana/validation";

import { api, ApiClientError } from "@/lib/api";
import { formatDateOnly } from "@/lib/trips/date";
import {
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_CHIP_CLASS,
  ENQUIRY_STATUS_LABELS,
  secondaryButtonClass,
} from "@/components/admin/shared";

/**
 * Admin concierge queue (D6): travelers' enquiries arrive here with their
 * brief; admins advance the pipeline (NEW → IN_REVIEW → QUOTED → CONVERTED,
 * CLOSED is terminal) and claim ownership of a case.
 */
export default function AdminEnquiriesPage() {
  const [items, setItems] = useState<Enquiry[] | null>(null);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<EnquiryStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then(({ user }) => setMe(user))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      api
        .adminEnquiries({ q: q.trim() || undefined, status: status || undefined })
        .then(({ items: rows }) => {
          if (!active) return;
          setItems(rows);
          setError(null);
        })
        .catch((err) => {
          if (!active) return;
          if (err instanceof ApiClientError && err.status === 403) {
            setError("Admin access is required for this queue.");
          } else {
            setError(err instanceof Error ? err.message : "Could not load enquiries.");
          }
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q, status]);

  async function patch(id: string, input: { status?: EnquiryStatus; assignedAdminId?: string | null }) {
    setBusyId(id);
    setError(null);
    setFeedback(null);
    try {
      const { enquiry } = await api.updateEnquiry(id, input);
      setItems((rows) => (rows ?? []).map((row) => (row.id === id ? enquiry : row)));
      setFeedback(`${enquiry.code} updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the enquiry");
    } finally {
      setBusyId(null);
    }
  }

  /** Spam / personal-data cleanup (D28): audited on the server. */
  async function deleteEnquiryRow(enquiry: Enquiry) {
    if (
      !window.confirm(
        `Delete ${enquiry.code} from ${enquiry.name}? The contact details are removed permanently and this cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(enquiry.id);
    setError(null);
    setFeedback(null);
    try {
      await api.deleteEnquiry(enquiry.id);
      setItems((rows) => (rows ?? []).filter((row) => row.id !== enquiry.id));
      setFeedback(`${enquiry.code} deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the enquiry");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Concierge queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trip enquiries waiting on a human. Reply by email using the reference code — the
            pipeline before booking (Phase 4).
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3" role="search" aria-label="Filter enquiries">
        <div className="relative">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label className="sr-only" htmlFor="q">
            Search enquiries
          </label>
          <input
            id="q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search name, email, phone or code…"
            className="w-72 rounded-card border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            maxLength={120}
          />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          <button
            type="button"
            onClick={() => setStatus("")}
            aria-pressed={status === ""}
            className={
              status === ""
                ? "rounded-card bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                : "rounded-card border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            }
          >
            All stages
          </button>
          {ENQUIRY_STATUSES.map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setStatus(value)}
              aria-pressed={status === value}
              className={
                status === value
                  ? "rounded-card bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                  : "rounded-card border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {ENQUIRY_STATUS_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {feedback ? <p className="mt-4 text-sm text-primary">{feedback}</p> : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {items === null && !error ? (
        <p className="mt-10 text-sm text-muted-foreground" role="status">
          Loading the queue…
        </p>
      ) : null}

      {items !== null && items.length === 0 ? (
        <div className="mt-10 rounded-card border border-dashed border-border bg-card px-6 py-12 text-center">
          <Inbox aria-hidden className="mx-auto h-10 w-10 text-primary/50" />
          <h2 className="mt-3 font-display text-xl">No enquiries here yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            When travelers ask the concierge team for help — from the planner or the public form —
            they land in this queue.
          </p>
        </div>
      ) : null}

      {items !== null && items.length > 0 ? (
        <ul className="tg-stagger mt-6 flex flex-col gap-4">
          {items.map((enquiry) => {
            const allowed = ENQUIRY_STATUS_TRANSITIONS[enquiry.status] ?? [];
            return (
              <li key={enquiry.id} className="rounded-card border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{enquiry.code}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ENQUIRY_STATUS_CHIP_CLASS[enquiry.status]}`}
                      >
                        {ENQUIRY_STATUS_LABELS[enquiry.status]}
                      </span>
                      {enquiry.assignedAdminId ? (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                          <UserCheck aria-hidden className="h-3 w-3" />
                          {enquiry.assignedAdminId === me?.id ? "Assigned to you" : "Assigned"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold">{enquiry.name}</p>
                    <p className="text-sm text-muted-foreground">
                      <a href={`mailto:${enquiry.email}`} className="underline-offset-2 hover:underline">
                        {enquiry.email}
                      </a>
                      {enquiry.phone ? ` · ${enquiry.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {me ? (
                      enquiry.assignedAdminId === me.id ? (
                        <button
                          type="button"
                          onClick={() => void patch(enquiry.id, { assignedAdminId: null })}
                          disabled={busyId === enquiry.id}
                          className={secondaryButtonClass}
                        >
                          Unassign
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void patch(enquiry.id, { assignedAdminId: me.id })}
                          disabled={busyId === enquiry.id}
                          className={secondaryButtonClass}
                        >
                          Assign to me
                        </button>
                      )
                    ) : null}
                    {allowed.map((next) => (
                      <button
                        type="button"
                        key={next}
                        onClick={() => void patch(enquiry.id, { status: next as EnquiryStatus })}
                        disabled={busyId === enquiry.id}
                        className="rounded-card bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-opacity hover:opacity-90 disabled:opacity-50"
                        title={`Move to ${ENQUIRY_STATUS_LABELS[next as EnquiryStatus]}`}
                      >
                        {busyId === enquiry.id ? (
                          <Loader2 aria-hidden className="mr-1 inline h-3 w-3 animate-spin" />
                        ) : null}
                        {ENQUIRY_STATUS_LABELS[next as EnquiryStatus]}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => void deleteEnquiryRow(enquiry)}
                      disabled={busyId === enquiry.id}
                      className="inline-flex items-center gap-1.5 rounded-card border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                      title="Delete this enquiry (removes contact details permanently)"
                    >
                      {busyId === enquiry.id ? (
                        <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 aria-hidden className="h-3 w-3" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
                    <dt className="sr-only">Travel dates</dt>
                    <dd className="text-muted-foreground">
                      {enquiry.startDate ? formatDateOnly(enquiry.startDate) : "Dates not set"}
                      {enquiry.endDate ? ` – ${formatDateOnly(enquiry.endDate)}` : ""}
                    </dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
                    <dt className="sr-only">Party</dt>
                    <dd className="text-muted-foreground">
                      {enquiry.adults} {enquiry.adults === 1 ? "adult" : "adults"}
                      {enquiry.children > 0 ? ` · ${enquiry.children} children` : ""}
                    </dd>
                  </div>
                  {enquiry.budgetRange ? (
                    <div>
                      <dt className="sr-only">Budget range</dt>
                      <dd className="text-muted-foreground">Budget: {enquiry.budgetRange}</dd>
                    </div>
                  ) : null}
                  {enquiry.tripId ? (
                    <div>
                      <dt className="sr-only">Linked trip</dt>
                      <dd>
                        <Link
                          href={`/trips/${enquiry.tripId}`}
                          className="text-sm font-medium text-primary underline underline-offset-2"
                        >
                          Open linked trip
                        </Link>
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {enquiry.destinations.length > 0 ? (
                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin aria-hidden className="h-3.5 w-3.5" />
                      {enquiry.destinations.join(", ")}
                    </span>
                  </p>
                ) : null}
                {enquiry.interests.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Interests: {enquiry.interests.join(", ").toLowerCase()}
                  </p>
                ) : null}
                {enquiry.accommodationPref ? (
                  <p className="mt-2 rounded-card bg-muted px-3 py-2 text-sm">
                    <span className="font-medium">Stay:</span> {enquiry.accommodationPref}
                  </p>
                ) : null}
                {enquiry.transportPref ? (
                  <p className="mt-2 rounded-card bg-muted px-3 py-2 text-sm">
                    <span className="font-medium">Transport:</span> {enquiry.transportPref}
                  </p>
                ) : null}
                {enquiry.specialRequests ? (
                  <p className="mt-2 rounded-card bg-muted px-3 py-2 text-sm">
                    <span className="font-medium">Requests:</span> {enquiry.specialRequests}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">
                  Received {formatDateOnly(enquiry.createdAt.slice(0, 10))}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}
