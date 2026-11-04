"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Star, X } from "lucide-react";
import type { AdminPackageReviewDto, PackageReviewStatus } from "@travelghana/types";

import { api, ApiClientError, validationIssues } from "@/lib/api";
import {
  formatDateTime,
  FormFeedback,
  inputClass,
  secondaryButtonClass,
} from "@/components/admin/shared";

type StatusFilter = "" | PackageReviewStatus;

const STATUS_OPTIONS: Array<{ value: Exclude<StatusFilter, "">; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved (visible)" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_CHIP: Record<PackageReviewStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  APPROVED: "bg-primary/10 text-primary",
  REJECTED: "bg-accent/10 text-accent",
};

/** Moderation queue for package reviews (D42). Travelers can only submit
 * with a team-confirmed booking behind them; from here an approve makes the
 * review public, a reject keeps a written reason on the record and hides the
 * text forever. Decisions are possible only while a review is pending. */

const actionButtonClass =
  "inline-flex items-center gap-1.5 rounded-card border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted/60 disabled:opacity-50";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden
          className={`h-4 w-4 ${value <= rating ? "text-secondary" : "text-muted-foreground/30"}`}
          fill={value <= rating ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export default function AdminReviewsPage() {
  const [items, setItems] = useState<AdminPackageReviewDto[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Row whose reject-reason panel is open. */
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback((filter: StatusFilter) => {
    api
      .adminReviews(filter || undefined)
      .then(({ items: next, total: nextTotal }) => {
        setItems(next);
        setTotal(nextTotal);
        setError(null);
      })
      .catch((err) => {
        setItems([]);
        setTotal(null);
        setError(err instanceof Error ? err.message : "Could not load the reviews.");
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

  async function decide(review: AdminPackageReviewDto, decision: "approve" | "reject") {
    if (decision === "reject" && reason.trim().length < 2) {
      setError("Write the rejection reason - it stays on the record.");
      return;
    }
    setBusyId(review.id);
    setError(null);
    try {
      const { review: next } =
        decision === "approve"
          ? await api.adminApproveReview(review.id)
          : await api.adminRejectReview(review.id, reason.trim());
      // Pending rows leave the queue after the decision; in the approved or
      // rejected buckets the row is replaced in place.
      if (status === "PENDING" || status === "") {
        setItems((prev) => (prev ?? []).filter((row) => row.id !== next.id));
        setTotal((prev) => (prev === null ? null : Math.max(0, prev - 1)));
      } else {
        setItems((prev) => (prev ?? []).map((row) => (row.id === next.id ? next : row)));
      }
      setRejectingId(null);
      setReason("");
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 pb-24">
      <div>
        <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
          Admin
        </p>
        <h1 className="animate-rise mt-1 font-display text-3xl [animation-delay:40ms] sm:text-4xl">
          Package reviews
        </h1>
        <p className="animate-rise mt-2 max-w-2xl text-muted-foreground [animation-delay:80ms]">
          Every review comes from a traveler with a confirmed booking, and nothing goes
          public until you approve it. Rejections keep their written reason on the record.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <FormFeedback message={error} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {total !== null ? (
          <p aria-live="polite" className="text-sm font-medium">
            {total} {total === 1 ? "review" : "reviews"}
          </p>
        ) : null}
        <label className="sm:w-56">
          <span className="sr-only">Filter by moderation status</span>
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
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Loading reviews...
          </p>
        ) : null}
        {items !== null && items.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No reviews with this status yet.
          </p>
        ) : null}
        {items?.map((review) => (
          <article
            key={review.id}
            className="rounded-card border border-border bg-card p-5"
            aria-label={`Review of ${review.package.title} by ${review.author.email}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Stars rating={review.rating} />
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CHIP[review.status]}`}
              >
                {review.status.toLowerCase()}
              </span>
            </div>
            {review.body ? (
              <p className="mt-3 rounded-card bg-muted/50 px-3 py-2 text-sm leading-relaxed text-foreground">
                {review.body}
              </p>
            ) : (
              <p className="mt-3 text-sm italic text-muted-foreground">No written text - star rating only.</p>
            )}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Package</dt>
                <dd className="mt-0.5 font-medium">
                  <Link href={`/packages/${review.package.slug}`} className="hover:text-primary hover:underline">
                    {review.package.title}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Traveler</dt>
                <dd className="mt-0.5 font-medium">
                  {review.author.name ?? "Member"}
                  <span className="text-muted-foreground"> - </span>
                  {review.author.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Verified booking</dt>
                <dd className="mt-0.5 font-medium">
                  <span className="font-mono">{review.booking.code}</span>
                  <span className="text-muted-foreground"> ({review.booking.status.toLowerCase()})</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Submitted</dt>
                <dd className="mt-0.5 font-medium">{formatDateTime(review.createdAt)}</dd>
              </div>
            </dl>
            {review.status === "REJECTED" && review.decisionNote ? (
              <p className="mt-3 rounded-card border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-accent">
                Rejection reason: {review.decisionNote}
              </p>
            ) : null}

            {review.status === "PENDING" ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void decide(review, "approve")}
                  disabled={busyId !== null}
                  className={`${actionButtonClass} border-primary/40 text-primary`}
                >
                  {busyId === review.id ? (
                    <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check aria-hidden className="h-3.5 w-3.5" />
                  )}
                  Approve &amp; publish
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectingId((prev) => (prev === review.id ? null : review.id));
                    setReason("");
                  }}
                  disabled={busyId !== null}
                  className={`${actionButtonClass} border-accent/40 text-accent`}
                >
                  <X aria-hidden className="h-3.5 w-3.5" /> Reject with reason
                </button>
              </div>
            ) : null}

            {rejectingId === review.id && review.status === "PENDING" ? (
              <form
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void decide(review, "reject");
                }}
                className="mt-3 flex flex-col gap-2"
              >
                <label className="text-sm">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Rejection reason (kept on the record)
                  </span>
                  <textarea
                    value={reason}
                    rows={2}
                    onChange={(event) => setReason(event.target.value)}
                    className={`${inputClass} mt-1`}
                    placeholder="e.g. This review is about another trip"
                    maxLength={500}
                  />
                </label>
                <div className="flex gap-2">
                  <button type="submit" disabled={busyId !== null} className={`${secondaryButtonClass} border-accent/40 text-accent`}>
                    <X aria-hidden className="h-3.5 w-3.5" /> Confirm rejection
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingId(null);
                      setReason("");
                    }}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  );
}
