import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "My trips" };

export default function TripsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="font-display text-4xl">My trips</h1>
      <p className="mt-3 text-muted-foreground">
        Trip planning — itineraries, bookings and day-by-day schedules — is the next build
        increment and will appear here.
      </p>
      <Link href="/explore" className="mt-6 inline-block font-medium text-primary underline-offset-4 hover:underline">
        Explore Ghana in the meantime
      </Link>
    </main>
  );
}
