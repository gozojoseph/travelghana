"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { AdminProviderDto } from "@travelghana/types";

import { api, ApiClientError, PROVIDER_TYPE_LABELS, type VerificationStatus } from "@/lib/api";
import {
  formatDateTime,
  secondaryButtonClass,
  VERIFICATION_CHIP_CLASS,
  VERIFICATION_LABELS,
} from "@/components/admin/shared";

const FILTERS: Array<VerificationStatus | "ALL"> = [
  "ALL",
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "SUSPENDED",
];

/**
 * Provider verification queue (D20): operators onboard businesses; admins
 * verify, reject or suspend them. Decisions are audited and queue an email
 * notification for the operator's account (delivery outbox — no provider yet).
 */
export default function AdminProvidersPage() {
  const [items, setItems] = useState<AdminProviderDto[] | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<VerificationStatus | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      api
        .adminProviders({
          q: q.trim() || undefined,
          verificationStatus: filter === "ALL" ? undefined : filter,
        })
        .then((result) => {
          if (!active) return;
          setItems(result.items);
          setError(null);
        })
        .catch((err) => {
          if (!active) return;
          setError(
            err instanceof ApiClientError && err.status === 403
              ? "Admin access is required."
              : err instanceof Error
                ? err.message
                : "Could not load providers.",
          );
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q, filter]);

  async function setStatus(id: string, verificationStatus: VerificationStatus) {
    setBusyId(id);
    setError(null);
    setFeedback(null);
    try {
      const { provider } = await api.setProviderVerification(id, verificationStatus);
      if (filter === "ALL") {
        setItems((rows) => (rows ?? []).map((row) => (row.id === id ? provider : row)));
      } else {
        // In a filtered queue the row moves out of view — reflect that.
        setItems((rows) => (rows ?? []).filter((row) => row.id !== id));
      }
      setFeedback(`${provider.name}: marked ${VERIFICATION_LABELS[provider.verificationStatus].toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the provider");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 pb-24">
      <header>
        <h1 className="font-display text-3xl">Providers</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Operator businesses on the platform. Verification is an editorial decision; the
          operator is notified as soon as it changes.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3" role="search" aria-label="Filter providers">
        <div className="relative">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label className="sr-only" htmlFor="q">
            Search providers
          </label>
          <input
            id="q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search name, slug or owner email…"
            className="w-72 rounded-card border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            maxLength={120}
          />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by verification status">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={
                filter === value
                  ? "rounded-card bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                  : "rounded-card border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {value === "ALL" ? "All" : VERIFICATION_LABELS[value]}
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
          Loading providers…
        </p>
      ) : null}

      {items !== null && items.length === 0 ? (
        <div className="mt-10 rounded-card border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="font-medium">No providers match</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Operators appear here as soon as they onboard a business.
          </p>
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {(items ?? []).map((provider) => (
          <li
            key={provider.id}
            className={
              provider.verificationStatus === "VERIFIED"
                ? "rounded-card border border-green-200 bg-card p-4"
                : provider.verificationStatus === "REJECTED" || provider.verificationStatus === "SUSPENDED"
                  ? "rounded-card border border-red-100 bg-card p-4"
                  : "rounded-card border border-border bg-card p-4"
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold">{provider.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {PROVIDER_TYPE_LABELS[provider.type] ?? provider.type}
                  {provider.cityName ? ` · ${provider.cityName}` : ""}
                  {provider.userEmail ? ` · ${provider.userEmail}` : " · no owner account"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  /{provider.slug} · onboarded {formatDateTime(provider.createdAt)} · listings{" "}
                  {provider.listingsPublished}/{provider.listingsTotal} live
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${VERIFICATION_CHIP_CLASS[provider.verificationStatus]}`}>
                {VERIFICATION_LABELS[provider.verificationStatus]}
              </span>
            </div>

            {provider.description ? (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{provider.description}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {provider.verificationStatus !== "VERIFIED" ? (
                <button
                  type="button"
                  onClick={() => void setStatus(provider.id, "VERIFIED")}
                  disabled={busyId === provider.id}
                  className="rounded-card bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  Verify
                </button>
              ) : null}
              {provider.verificationStatus !== "REJECTED" ? (
                <button
                  type="button"
                  onClick={() => void setStatus(provider.id, "REJECTED")}
                  disabled={busyId === provider.id}
                  className="rounded-card border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  Reject
                </button>
              ) : null}
              {provider.verificationStatus !== "SUSPENDED" ? (
                <button
                  type="button"
                  onClick={() => void setStatus(provider.id, "SUSPENDED")}
                  disabled={busyId === provider.id}
                  className={secondaryButtonClass}
                >
                  Suspend
                </button>
              ) : null}
              {provider.verificationStatus !== "UNVERIFIED" ? (
                <button
                  type="button"
                  onClick={() => void setStatus(provider.id, "UNVERIFIED")}
                  disabled={busyId === provider.id}
                  className="rounded-card border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Reset to unverified
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
