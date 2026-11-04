import type { Metadata } from "next";

import { PlanMyTrip } from "@/components/trips/plan-my-trip";

export const metadata: Metadata = {
  title: "Plan my trip",
  description:
    "Build a personalized day-by-day Ghana itinerary with real places, published listings and honest budget estimates.",
  alternates: { canonical: "/plan-my-trip" },
};

export default function PlanMyTripPage() {
  return <PlanMyTrip />;
}
