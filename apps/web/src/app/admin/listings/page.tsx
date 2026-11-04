"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Search } from "lucide-react";

import { api, ApiClientError, type ListingStatus, type ListingSummaryDto } from "@/lib/api";
import { formatDateTime, LISTING_STATUS_CHIPS } from "@/components/admin/shared";

/** Preset reasons for quick rejects — always editable before submission. */
const REJECT_REASONS = [
  "Photos are blurry or missing a hero image",
  "Price or capacity details are missing",
  "Description does not match the service offered",
];

/**
 * Admin listing review queue (D20): DRAFT submissions arrive as
 * PENDING_REVIEW; admins APPROVE (→ PUBLISHED / live), REJECT (→ DRAFT with a
 * required reason) or SUSPEND (→ PAUSED, parked in the queue). A PUBLISHED
 * listing cannot be touched by this queue — unpublishing happens via the
 * provider dashboard (DEL-8). Every decision is audited by the API and queues
 * a notification for the provider's account.
 */
export default function AdminListingsPage() {
  const [items, setItems] = useState<ListingSummaryDto[] | null>(null);
  const [scope, setScope] = useState<"PENDING_REVIEW" | "ALL">("PENDING_REVIEW");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // The reject decision needs a written reason (validated by the API too).
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    try {
      const list =
        scope === "PENDING_REVIEW"
          ? await api.adminListings("PENDING_REVIEW")
          : await api.adminListings("ALL");
      let rows = list.items;
      const needle = q.trim().toLowerCase();
      if (needle) {
        rows = rows.filter(
          (row) =>
            row.title.toLowerCase().includes(needle) ||
            row.providerName.toLowerCase().includes(needle),
        );
      }
      setItems(rows);
    } catch (err) {
      setError(err instanceof ApiClientError && err.status === 403 ? "Admin access is required." : err instanceof Error ? err.message : "Could not load the queue.");
    }
  }, [scope, q]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function decide(id: string, action: "APPROVE" | "REJECT" | "SUSPEND", reason?: string) {
    setBusyId(id);
    setError(null);
    setFeedback(null);
    try {
      const { listing } = await api.reviewListing(id, action, reason);
      setItems((rows) => (rows ?? []).map((row) => (row.id === id ? listing : row)));
      setFeedback(
        `“${listing.title}” ${action === "APPROVE" ? "approved — now live" : action === "REJECT" ? "rejected — sent back to draft with your reason" : "parked — paused and out of the review queue"}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "The decision could not be recorded");
    } finally {
      setBusyId(null);
    }
  }

  function openReject(id: string) {
    setRejectFor(id);
    setNote("");
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 pb-24">
      <header>
        <h1 className="font-display text-3xl">Listing review</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Operator submissions move DRAFT → PENDING_REVIEW. Approve to publish, reject with
        a reason (the provider sees it), or park it as paused while you talk to the operator.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3" role="search" aria-label="Filter listings">
        <div className="relative">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label className="sr-only" htmlFor="q">
            Search listings
          </label>
          <input
            id="q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search title or provider…"
            className="w-72 rounded-card border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            maxLength={120}
          />
        </div>
        <div className="flex gap-1" role="group" aria-label="Queue scope">
          {(["PENDING_REVIEW", "ALL"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              aria-pressed={scope === value}
              className={
                scope === value
                  ? "rounded-card bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                  : "rounded-card border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {value === "PENDING_REVIEW" ? "In review" : "All listings"}
            </button>
          ))}
        </div>
      </div>

      {feedback ? (
        <p className="mt-4 text-sm text-primary" role="status">
          {feedback}
        </p>
      ) : null}
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
          <p className="font-medium">Nothing here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope === "PENDING_REVIEW"
              ? "No submissions are waiting for review."
              : "No listings match this search."}
          </p>
        </div>
      ) : null}

      <ul className="mt-6 space-y-4">
        {(items ?? []).map((item) => (
          <li key={item.id} className="rounded-card border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold">{item.title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {item.providerName}
                  {item.cityName || item.regionName ? (
                    <>
                      {" · "}
                      <MapPin aria-hidden className="inline h-3.5 w-3.5" />
                      {[item.cityName, item.regionName].filter(Boolean).join(", ")}
                    </>
                  ) : null}
                  <span aria-hidden> · </span>
                  <span>{formatDateTime(item.createdAt)}</span>
                </p>
              </div>
              <StatusChip status={item.status} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {item.durationMinutes ? <span className="rounded-card bg-muted px-2 py-1">{item.durationMinutes} min</span> : null}
              <span className="rounded-card bg-muted px-2 py-1">Capacity {item.capacity}</span>
              <span className="rounded-card bg-muted px-2 py-1">
                {(item.priceMinor / 100).toLocaleString("en-GH", { style: "currency", currency: item.currencyCode })}
              </span>
            </div>

            {rejectFor === item.id ? (
              <form
                className="mt-4 rounded-card border border-amber-200 bg-amber-50 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const reason = note.trim();
                  if (reason.length < 4) {
                    setError("Give the provider a reason of at least 4 characters.");
                    return;
                  }
                  void decide(item.id, "REJECT", reason);
                  setRejectFor(null);
                  setNote("");
                }}
              >
                <label htmlFor={`note-${item.id}`} className="text-xs font-semibold text-amber-800">
                  Reason the provider will see (required)
                </label>
                <textarea
                  id={`note-${item.id}`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  maxLength={500}
                  className="mt-1 w-full rounded-card border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="e.g. Photos are blurry and the price is missing"
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {REJECT_REASONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="rounded-full border border-amber-300 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100"
                      onClick={() => setNote(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={busyId === item.id}
                    className="rounded-card bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject with reason
                  </button>
                  <button
                    type="button"
                    className="rounded-card border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setRejectFor(null);
                      setNote("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : item.status === "PENDING_REVIEW" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void decide(item.id, "APPROVE")}
                  disabled={busyId === item.id}
                  className="rounded-card bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {busyId === item.id ? "Working…" : "Approve & publish"}
                </button>
                <button
                  type="button"
                  onClick={() => openReject(item.id)}
                  disabled={busyId === item.id}
                  className="rounded-card border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  Reject…
                </button>
                <button
                  type="button"
                  onClick={() => void decide(item.id, "SUSPEND")}
                  disabled={busyId === item.id}
                  className="rounded-card border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
                >
                  Park (paused)
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}

function StatusChip({ status }: { status: ListingStatus }) {
  const chip = LISTING_STATUS_CHIPS[status];
  if (!chip) return <span className="text-xs text-muted-foreground">{status}</span>;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${chip.className}`}>
      {chip.label}
    </span>
  );
}
