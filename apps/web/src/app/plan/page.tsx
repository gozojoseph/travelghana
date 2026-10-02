import type { Metadata } from "next";
import Link from "next/link";
import { Route } from "lucide-react";

export const metadata: Metadata = {
  title: "Plan your trip",
  description: "Tell us about your dream Ghana trip and our concierge team will build it with you.",
};

/** Trip planning entry (§10 custom enquiry) — full flow arrives with the trips increment. */
export default function PlanPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start px-6 py-20">
      <Route aria-hidden className="h-10 w-10 text-primary" />
      <h1 className="mt-4 font-display text-4xl">Plan my trip</h1>
      <p className="mt-3 text-muted-foreground">
        Tell us when you&apos;re coming, who&apos;s traveling, and what you love — our team builds
        the itinerary, books trusted providers, and arranges your driver. The full request-a-trip
        form is coming in the next release.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/explore"
          className="rounded-card bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          Explore destinations meanwhile
        </Link>
      </div>
    </main>
  );
}
