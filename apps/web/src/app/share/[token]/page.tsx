import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiClientError } from "@/lib/api";
import { fetchSharedTrip } from "@/lib/trips/share";
import type { TripShareView } from "@travelghana/types";

import { ShareTripView } from "@/components/trips/share-trip-view";

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * A sanitizer-by-construction surface (D19): the page renders only what the
 * share endpoint returns; missing/revoked tokens 404 without explanation.
 * Not indexed — share links travel by message, not by search.
 */
export const metadata: Metadata = {
  title: "A shared trip plan · TravelGhana",
  robots: { index: false, follow: false },
};

export default async function SharedTripPage({ params }: Props) {
  const { token } = await params;

  const result: { view: TripShareView | null; failed: boolean } = {
    view: null,
    failed: false,
  };
  try {
    const { share } = await fetchSharedTrip(token);
    result.view = share;
  } catch (error) {
    if (error instanceof ApiClientError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    result.failed = true;
  }

  if (result.view) return <ShareTripView share={result.view} />;

  // Anything else (API down, network): an honest, retryable state.
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-center">
      <h1 className="font-display text-3xl">This shared plan is taking a moment</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        We couldn&apos;t load the trip right now. Ask the person who shared it for a new link, or
        try again shortly.
      </p>
    </main>
  );
}
