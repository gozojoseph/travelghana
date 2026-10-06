"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ListingForm } from "@/components/operator/listing-form";

export default function NewListingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/operator/listings"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to listings
      </Link>
      <h1 className="mt-4 font-display text-3xl">New listing</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Add a service. It will stay in Draft until you submit it for review.
      </p>
      <div className="mt-8 rounded-card border border-border bg-card p-6">
        <ListingForm mode="create" />
      </div>
    </main>
  );
}
