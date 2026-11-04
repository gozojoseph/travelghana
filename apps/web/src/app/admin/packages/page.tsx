"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Edit3,
  Loader2,
  Package as PackageIcon,
  PackageOpen,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import type { PackageStatus, PackageSummary } from "@travelghana/types";

import { api } from "@/lib/api";
import { formatGhs } from "@/lib/format";
import {
  buttonClass,
  dangerButtonClass,
  FormFeedback,
  inputClass,
  PACKAGE_STATUS_CHIP_CLASS,
  PACKAGE_STATUS_LABELS,
  PACKAGE_STATUSES,
  secondaryButtonClass,
} from "@/components/admin/shared";

export default function AdminPackagesPage() {
  const [items, setItems] = useState<PackageSummary[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<PackageStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      api
        .adminPackages({ q: q.trim() || undefined, status: status || undefined })
        .then(({ items: next }) => {
          if (!active) return;
          setItems(next);
          setError(null);
        })
        .catch((err) => {
          if (!active) return;
          setItems([]);
          setError(err instanceof Error ? err.message : "Could not load packages.");
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q, status]);

  async function togglePublish(pkg: PackageSummary) {
    setBusyId(pkg.id);
    setError(null);
    setFeedback(null);
    try {
      const nextStatus: PackageStatus = pkg.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      const { package: updated } = await api.updatePackage(pkg.id, { status: nextStatus });
      setItems((prev) =>
        prev ? prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)) : prev,
      );
      setFeedback(
        nextStatus === "PUBLISHED"
          ? `“${updated.title}” is now published.`
          : `“${updated.title}” moved back to draft.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the package.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(pkg: PackageSummary) {
    if (!window.confirm(`Delete “${pkg.title}”? This cannot be undone.`)) return;

    setBusyId(pkg.id);
    setError(null);
    setFeedback(null);
    try {
      await api.deletePackage(pkg.id);
      setItems((prev) => (prev ? prev.filter((item) => item.id !== pkg.id) : prev));
      setFeedback(`“${pkg.title}” was deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the package.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
            Admin
          </p>
          <h1 className="animate-rise mt-1 font-display text-4xl [animation-delay:40ms]">
            Packages
          </h1>
          <p className="animate-rise mt-2 max-w-2xl text-muted-foreground [animation-delay:80ms]">
            Multi-day journeys you create. Keep drafts private, publish when ready and keep the
            day-by-day outline current.
          </p>
        </div>
        <Link
          href="/admin/packages/new"
          className={`${buttonClass} inline-flex items-center gap-2`}
        >
          <Plus aria-hidden className="h-4 w-4" />
          New package
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search packages</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search by title or destination"
            className={`${inputClass} pl-11`}
          />
        </label>
        <label className="sm:w-48">
          <span className="sr-only">Filter by status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as PackageStatus | "")}
            className={inputClass}
          >
            <option value="">All statuses</option>
            {PACKAGE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {PACKAGE_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {feedback ? (
          <p
            role="status"
            className="animate-pop rounded-card border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
          >
            {feedback}
          </p>
        ) : null}
        <FormFeedback message={error} />
      </div>

      {items === null ? (
        <>
          <span role="status" className="sr-only">
            Loading packages…
          </span>
          <div className="mt-8 flex flex-col gap-3" aria-hidden>
            {[0, 1, 2].map((index) => (
              <div key={index} className="animate-pulse rounded-card border border-border bg-card p-5">
                <div className="h-6 w-1/2 rounded bg-muted" />
                <div className="mt-3 h-4 w-2/3 rounded bg-muted" />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {items !== null && items.length === 0 ? (
        <div className="animate-rise mt-10 flex flex-col items-start rounded-card border border-dashed border-border bg-card px-6 py-12">
          <PackageOpen aria-hidden className="h-10 w-10 text-primary/60" />
          <h2 className="mt-4 font-display text-2xl">
            {q || status ? "No matching packages" : "No packages yet"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {q || status
              ? "Try a different search or status filter."
              : "Create the first journey: set the destination, duration and price, then write the day-by-day outline."}
          </p>
          {!q && !status ? (
            <Link
              href="/admin/packages/new"
              className="mt-6 rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]"
            >
              Create a package
            </Link>
          ) : null}
        </div>
      ) : null}

      {items !== null && items.length > 0 ? (
        <div className="tg-stagger mt-8 flex flex-col gap-3">
          {items.map((pkg) => (
            <div
              key={pkg.id}
              className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary sm:flex-row sm:items-center"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-primary/10 text-primary">
                <PackageIcon aria-hidden className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/packages/${pkg.id}`}
                    className="font-display text-xl transition-colors hover:text-primary"
                  >
                    {pkg.title}
                  </Link>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PACKAGE_STATUS_CHIP_CLASS[pkg.status]}`}
                  >
                    {PACKAGE_STATUS_LABELS[pkg.status]}
                  </span>
                  {pkg.featured ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary">
                      <Star aria-hidden className="h-3.5 w-3.5 fill-current" />
                      Featured
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pkg.destination ? pkg.destination.name : "No destination"} ·{" "}
                  {pkg.durationDays} days / {pkg.durationNights} nights · {pkg.dayCount} outline{" "}
                  {pkg.dayCount === 1 ? "day" : "days"} · {formatGhs(pkg.priceMinor)}
                </p>
                {pkg.summary ? (
                  <p className="mt-1 text-sm text-muted-foreground">{pkg.summary}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/packages/${pkg.id}`}
                  className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
                >
                  <Edit3 aria-hidden className="h-4 w-4" />
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => void togglePublish(pkg)}
                  disabled={busyId === pkg.id}
                  className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
                >
                  {busyId === pkg.id ? (
                    <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                  ) : null}
                  {pkg.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(pkg)}
                  disabled={busyId === pkg.id}
                  className={`${dangerButtonClass} inline-flex items-center gap-1.5`}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}
