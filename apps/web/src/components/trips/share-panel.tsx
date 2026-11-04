"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, RotateCcw, Share2 } from "lucide-react";
import type { TripDetail, TripShareStatus } from "@travelghana/types";

import { ApiClientError } from "@/lib/api";
import { createShare, getShareStatus, revokeShare } from "@/lib/trips/share";
import { isDemoTrips } from "@/lib/trips";

import { dangerButtonClass, secondaryButtonClass } from "./shared";

/**
 * Trip share links (D19): a token-gated, read-only companion view of the
 * plan. The link deliberately reveals the itinerary shape only — no prices,
 * no notes, no traveler needs (§11). API-mode only; demo trips live in the
 * browser and have nothing to share.
 */
export function SharePanel({ trip }: { trip: TripDetail }) {
  const [status, setStatus] = useState<TripShareStatus | null | undefined>(
    isDemoTrips ? null : undefined, // undefined = not loaded yet
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isDemoTrips) return;
    let active = true;
    void getShareStatus(trip.id)
      .then(({ share }) => {
        if (!active) return;
        // Keep whatever is already there (demo-safe + no refetch loop).
        setStatus((current) => (current === undefined ? share : current));
      })
      .catch(() => {
        if (active) setError("Could not check the share link. Try again in a moment.");
      });
    return () => {
      active = false;
    };
  }, [trip.id]);

  async function run(action: "enable" | "revoke") {
    if (status === undefined) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const { share } = action === "enable" ? await createShare(trip.id) : await revokeShare(trip.id);
      setStatus(share);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/trips/${trip.id}`)}`;
        return;
      }
      setError(
        action === "enable"
          ? "Could not create the link. Try again in a moment."
          : "Could not turn the link off. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!status?.path) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${status.path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copying was blocked by the browser. Copy the link text manually.");
    }
  }

  if (isDemoTrips) {
    return (
      <section className="rounded-card border border-dashed border-border bg-card px-5 py-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <Share2 aria-hidden className="h-4 w-4 text-primary" />
          Share link
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Preview mode: sharing works once you sign in and keep this trip saved on the live
          planner.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-border bg-card px-5 py-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <Share2 aria-hidden className="h-4 w-4 text-primary" />
        Share link
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Let travel companions follow along. Anyone with the link sees the plan outline — days,
        times and places. <span className="font-semibold">Never included:</span> your notes,
        prices, estimates and traveler needs. Links are read-only.
      </p>

      {status === undefined ? (
        <p className="mt-3 text-sm text-muted-foreground">Checking the share link…</p>
      ) : status && status.active && status.path ? (
        <div className="animate-pop mt-3">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={status.path}
              onFocus={(event) => event.currentTarget.select()}
              aria-label="Share link (site path)"
              className="min-w-0 flex-1 rounded-card border border-border bg-background px-3 py-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => void copyLink()}
              className={secondaryButtonClass}
              aria-label="Copy share link"
            >
              {copied ? (
                <Check aria-hidden className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
              ) : (
                <Copy aria-hidden className="mr-1.5 inline h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void run("enable")}
              disabled={busy}
              className={secondaryButtonClass}
              title="Create a new link — the current one stops working"
            >
              <RotateCcw aria-hidden className="mr-1.5 inline h-3.5 w-3.5" />
              Rotate link
            </button>
            <button
              type="button"
              onClick={() => void run("revoke")}
              disabled={busy}
              className={dangerButtonClass}
            >
              Turn sharing off
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void run("enable")}
          disabled={busy}
          className={`${secondaryButtonClass} mt-3 w-full`}
        >
          {busy ? (
            <Loader2 aria-hidden className="mr-2 inline h-4 w-4 animate-spin" />
          ) : (
            <Link2 aria-hidden className="mr-2 inline h-4 w-4" />
          )}
          Create a share link
        </button>
      )}

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
