"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Check, Loader2, MessagesSquare, Trash2 } from "lucide-react";
import type { AdminPackageBookingDto } from "@travelghana/types";

import { api, ApiClientError, validationIssues } from "@/lib/api";
import {
  formatDateTime,
  FormFeedback,
  inputClass,
  secondaryButtonClass,
} from "@/components/admin/shared";

type StatusFilter = "" | "PENDING_PAYMENT" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "REFUNDED" | "EXPIRED";

const STATUS_OPTIONS: Array<{ value: Exclude<StatusFilter, "">; label: string }> = [
  { value: "PENDING_PAYMENT", label: "Payment pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "EXPIRED", label: "Expired" },
];

const STATUS_CHIP: Record<string, string> = {
  PENDING_PAYMENT: "bg-muted text-muted-foreground",
  CONFIRMED: "bg-primary/10 text-primary",
  COMPLETED: "bg-primary/10 text-primary",
  CANCELLED: "bg-accent/10 text-accent",
  REFUNDED: "bg-accent/10 text-accent",
  EXPIRED: "bg-muted text-muted-foreground",
};

/** Queue for package booking requests (D25; outreach + decisions D36; manual
 * payments D44). Every new request already emails the traveler a receipt - the
 * confirmation email includes the settings payment instructions (Mobile Money
 * + bank transfer) with the booking code as the reference. From here you can
 * send an acknowledgement or a concern, confirm or cancel payment-pending
 * requests, and record when a confirmed booking was paid. Completed/refunded
 * transitions follow the payment rails; financial records are never deletable
 * (D28). */

const DELETABLE_STATUSES: ReadonlyArray<AdminPackageBookingDto["status"]> = [
  "PENDING_PAYMENT",
  "CANCELLED",
  "EXPIRED",
];

const actionButtonClass =
  "inline-flex items-center gap-1.5 rounded-card border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted/60 disabled:opacity-50";

export default function AdminBookingsPage() {
  const [items, setItems] = useState<AdminPackageBookingDto[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusFilter>("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Row whose outreach/decision panel is open. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(
    (filter: StatusFilter) => {
      api
        .adminPackageBookings(filter || undefined)
        .then(({ items: next, total: nextTotal }) => {
          setItems(next);
          setTotal(nextTotal);
          setError(null);
        })
        .catch((err) => {
          setItems([]);
          setTotal(null);
          setError(err instanceof Error ? err.message : "Could not load the bookings.");
        });
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load(status);
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [status, load]);

  function formatDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? "-"
      : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  /** D36 outreach + decision actions. Decisions replace the row in place. */
  async function runAction(
    booking: AdminPackageBookingDto,
    action: "acknowledge" | "concern" | "confirm" | "cancel",
  ) {
    setBusyId(booking.id);
    setError(null);
    try {
      if (action === "acknowledge") {
        await api.adminAcknowledgeBooking(booking.id, note.trim() || undefined);
      } else if (action === "concern") {
        await api.adminConcernBooking(booking.id, note.trim());
      } else {
        const decision = action === "confirm" ? "CONFIRMED" : "CANCELLED";
        const { booking: next } = await api.adminDecideBooking(
          booking.id,
          decision,
          note.trim() || undefined,
        );
        setItems((prev) => (prev ?? []).map((row) => (row.id === next.id ? next : row)));
      }
      setExpandedId(null);
      setNote("");
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

  /** Manual payments (D44): record payment received for a confirmed booking. */
  async function markBookingPaid(booking: AdminPackageBookingDto) {
    setBusyId(booking.id);
    setError(null);
    try {
      const { booking: next } = await api.adminMarkBookingPaid(booking.id);
      setItems((prev) => (prev ?? []).map((row) => (row.id === next.id ? next : row)));
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

  /** Junk-request cleanup (D28): server refuses financial records. */
  async function deleteBooking(booking: AdminPackageBookingDto) {
    if (
      !window.confirm(
        `Delete booking ${booking.code} (${booking.user.email})? This removes the request permanently - the traveler would have to book again.`,
      )
    ) {
      return;
    }
    setDeletingId(booking.id);
    setError(null);
    try {
      await api.adminDeleteBooking(booking.id);
      setItems((prev) => (prev ?? []).filter((row) => row.id !== booking.id));
      setTotal((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the booking.");
    } finally {
      setDeletingId(null);
    }
  }


  return (
    <main className="mx-auto max-w-5xl px-6 py-12 pb-24">
      <div>
        <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
          Admin
        </p>
        <h1 className="animate-rise mt-1 font-display text-3xl [animation-delay:40ms] sm:text-4xl">
          Bookings
        </h1>
        <p className="animate-rise mt-2 max-w-2xl text-muted-foreground [animation-delay:80ms]">
          Booking requests from &ldquo;Book now&rdquo; on the package pages. Each request already
          emailed the traveler a receipt - from here you can send an acknowledgement or a concern,
          and confirm or cancel requests that are still awaiting payment.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <FormFeedback message={error} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {total !== null ? (
          <p aria-live="polite" className="text-sm font-medium">
            {total} {total === 1 ? "booking" : "bookings"}
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
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Loading bookings...
          </p>
        ) : null}
        {items !== null && items.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No bookings with this status yet.
          </p>
        ) : null}
        {items?.map((booking) => (
          <article
            key={booking.id}
            className="rounded-card border border-border bg-card p-5"
            aria-label={`Booking ${booking.code}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold">{booking.code}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {formatDateTime(booking.createdAt)}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CHIP[booking.status] ?? "bg-muted text-muted-foreground"}`}
              >
                {booking.status.replace("_", " ").toLowerCase()}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Package</dt>
                <dd className="mt-0.5 font-medium">
                  <Link href={`/packages/${booking.package.slug}`} className="hover:text-primary hover:underline">
                    {booking.package.title}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Start date</dt>
                <dd className="mt-0.5 font-medium">{formatDate(booking.startDate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Traveler</dt>
                <dd className="mt-0.5 font-medium">
                  {booking.user.name ?? "Member"}
                  <span className="text-muted-foreground"> - </span>
                  {booking.user.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Party</dt>
                <dd className="mt-0.5 font-medium">
                  {booking.adults} {booking.adults === 1 ? "adult" : "adults"}
                  {booking.children > 0 ? `, ${booking.children} children` : ""}
                </dd>
              </div>
            </dl>
            {booking.notes ? (
              <p className="mt-3 rounded-card bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {booking.notes}
              </p>
            ) : null}
            <footer className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => {
                  setNote("");
                  setExpandedId((prev) => (prev === booking.id ? null : booking.id));
                }}
                aria-expanded={expandedId === booking.id}
                className={actionButtonClass}
              >
                <MessagesSquare aria-hidden className="h-3.5 w-3.5" />
                {expandedId === booking.id ? "Close" : "Email the traveler..."}
              </button>
              {DELETABLE_STATUSES.includes(booking.status) ? (
                <button
                  type="button"
                  onClick={() => void deleteBooking(booking)}
                  disabled={deletingId !== null}
                  className="inline-flex items-center gap-1.5 rounded-card border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === booking.id ? (
                    <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  )}
                  {deletingId === booking.id ? "Deleting..." : "Delete"}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Financial record - it cannot be deleted, and later status transitions follow the
                  payment rails.
                </span>
              )}
              {booking.status === "PENDING_PAYMENT" ? (
                <span className="text-xs text-muted-foreground">Awaiting your decision</span>
              ) : null}
              {booking.status === "CONFIRMED" ? (
                booking.paidAt ? (
                  <span className="text-xs font-medium text-primary">
                    Paid {formatDate(booking.paidAt)} on record
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void markBookingPaid(booking)}
                    disabled={busyId !== null}
                    className={`${actionButtonClass} border-primary/40 text-primary`}
                  >
                    {busyId === booking.id ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check aria-hidden className="h-3.5 w-3.5" />
                    )}
                    Mark paid
                  </button>
                )
              ) : null}
            </footer>
            {expandedId === booking.id ? (
              <div className="mt-3 rounded-card border border-border bg-muted/30 p-4">
                <label htmlFor={`outreach-note-${booking.id}`} className="mb-1.5 block text-sm font-medium">
                  Optional message (sent as the acknowledgement or concern text; used as the
                  cancellation reason)
                </label>
                <textarea
                  id={`outreach-note-${booking.id}`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder={"e.g. Calling you tomorrow about availability for that weekend."}
                  className={`${inputClass} resize-y`}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void runAction(booking, "acknowledge")}
                    className={actionButtonClass}
                  >
                    {busyId === booking.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    Send acknowledgement
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null || note.trim().length === 0}
                    onClick={() => void runAction(booking, "concern")}
                    className={actionButtonClass}
                  >
                    Send concern
                  </button>
                  {booking.status === "PENDING_PAYMENT" ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void runAction(booking, "confirm")}
                        className="inline-flex items-center gap-1.5 rounded-card bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        Confirm booking
                      </button>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void runAction(booking, "cancel")}
                        className="inline-flex items-center gap-1.5 rounded-card border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancel booking
                      </button>
                    </>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Emails go from TravelGhana to {booking.user.email}; every action is recorded in
                  the audit log.
                </p>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <CalendarCheck aria-hidden className="h-3.5 w-3.5" />
        Receipts are automatic; acknowledgements, concerns and confirm/cancel decisions email the
        traveler from here. Completed and refunded statuses come with the payment integration.
      </p>
      <Link href="/admin" className={`${secondaryButtonClass} mt-4 inline-flex`}>
        Back to dashboard
      </Link>
    </main>
  );
}
