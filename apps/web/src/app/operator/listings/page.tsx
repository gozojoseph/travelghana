"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Home, ListFilter, Plus, Search, Tag, X } from "lucide-react";

import { api, type ListingStatus, type ListingSummaryDto } from "@/lib/api";

import { handleLoadError, toCedisDisplay } from "@/components/operator/shared";

type Filter =
  | "ALL"
  | ListingStatus.DRAFT
  | ListingStatus.PENDING_REVIEW
  | ListingStatus.PUBLISHED
  | ListingStatus.PAUSED
  | ListingStatus.ARCHIVED;

export default function OperatorListingsPage() {
  const [items, setItems] = useState<ListingSummaryDto[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.myListings(filter === "ALL" ? undefined : filter);
      setItems(res.items);
      setState("ready");
    } catch (err) {
      handleLoadError(err);
      setState("error");
    }
  }, [filter]);

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFilter("ALL");
    load();
  }

  async function handleFilter(status: Filter) {
    setFilter(status);
    setQuery("");
    load();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-secondary">Operator</p>
          <h1 className="mt-1 font-display text-4xl">Your listings</h1>
          <p className="mt-2 text-muted-foreground">
            Publish each service — travelers search only published listings.
          </p>
        </div>
        <Link
          href="/operator/listings/new"
          className="flex items-center gap-2 rounded-card bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus aria-hidden className="h-4 w-4" /> New listing
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mt-6 flex items-center gap-2">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search your listings…"
            onChange={(e) => setQuery(e.target.value)}
            className="w-56 rounded-card border border-border bg-card py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <button type="submit" className="rounded-card bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          Search
        </button>
      </form>

      {/* Status filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            { value: "ALL" as Filter, label: "All" },
            { value: "DRAFT" as Filter, label: "Draft" },
            { value: "PENDING_REVIEW" as Filter, label: "Pending review" },
            { value: "PUBLISHED" as Filter, label: "Published" },
            { value: "PAUSED" as Filter, label: "Paused" },
            { value: "ARCHIVED" as Filter, label: "Archived" },
          ] as { value: Filter; label: string }[]
        ).map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => handleFilter(f.value)}
            className={`flex items-center gap-1.5 rounded-card px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListFilter aria-hidden className="h-3.5 w-3.5" />
            {f.label}
          </button>
        ))}
      </div>

      {state === "error" ? (
        <div className="mt-8 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load your listings. Check the API is running and retry.
        </div>
      ) : null}

      {state === "ready" && items.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-border p-12 text-center">
          <p className="font-medium">No listings yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === "ALL"
              ? "Create your first listing — it starts as a draft until you submit it for review."
              : `No listings in the “${filter}” state.`}
          </p>
          {filter === "ALL" ? (
            <Link
              href="/operator/listings/new"
              className="mt-4 inline-block rounded-card bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Create a listing
            </Link>
          ) : null}
        </div>
      ) : null}

      <ul className="mt-8 flex flex-col gap-3">
        {items.map((listing) => (
          <li
            key={listing.id}
            className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-card p-5"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                {listing.title}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {listing.status}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {listing.providerName}
                {listing.cityName ? ` · ${listing.cityName}` : ""}
                {listing.regionName ? ` · ${listing.regionName}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {toCedisDisplay(listing.priceMinor)} per person · {listing.capacity} capacity
                {listing.durationMinutes ? ` · ${listing.durationMinutes} min` : ""}
              </p>
              {query && (
                <p
                  className="mt-1 text-sm text-muted-foreground"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: listing.title.replace(new RegExp(query, "gi"), (m) => `<strong>${m}</strong>`) }}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              {listing.status === "PENDING_REVIEW" || listing.status === "PUBLISHED" ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  {listing.status === "PUBLISHED" ? "Public" : "Awaiting review"}
                </span>
              ) : null}
              {listing.status === "PAUSED" ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Paused
                </span>
              ) : null}
              {listing.status === "ARCHIVED" ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Archived
                </span>
              ) : null}
              <Link
                href={`/operator/listings/${listing.id}`}
                className="flex items-center gap-1.5 rounded-card border border-border px-3 py-2 text-sm font-medium"
              >
                <ListFilter aria-hidden className="h-4 w-4" />
                Edit
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
