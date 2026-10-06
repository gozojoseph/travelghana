"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { api, type ListingStatus, type ListingSummaryDto } from "@/lib/api";

import { handleLoadError } from "@/components/operator/shared";
import { ListingForm } from "@/components/operator/listing-form";

export default function EditListingPage() {
  const params = useParams<{ id: string }>();
  const [listing, setListing] = useState<ListingSummaryDto | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.myListings();
        const found = res.items.find((l) => l.id === params.id) ?? null;
        setListing(found);
        setState(found ? "ready" : "missing");
      } catch (err) {
        handleLoadError(err);
        setState("error");
      }
    })();
  }, [params.id]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/operator/listings"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to listings
      </Link>
      <h1 className="mt-4 font-display text-3xl">
        {listing ? "Edit listing" : "Listing not found"}
      </h1>

      {state === "loading" ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : null}
      {state === "missing" ? (
        <p className="mt-8 text-muted-foreground">Listing not found — it may have been deleted.</p>
      ) : null}
      {state === "error" ? (
        <p className="mt-8 text-muted-foreground">Could not load this listing.</p>
      ) : null}

      {state === "ready" && listing ? (
        <div className="mt-8 rounded-card border border-border bg-card p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {listing.status}
            </span>
            {listing.status === "PENDING_REVIEW" ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Under review
              </span>
            ) : null}
            {listing.status === "PUBLISHED" ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Public
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
          </div>
          <ListingForm
            mode="edit"
            initial={{
              ...listing,
              published: listing.status === "PUBLISHED",
              priceMinor: listing.priceMinor,
            }}
          />
        </div>
      ) : null}
    </main>
  );
}
