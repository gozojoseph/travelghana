import type { Metadata } from "next";
import type { ReactNode } from "react";

import { TripsAuthGate } from "@/components/trips/trips-auth-gate";

export const metadata: Metadata = {
  title: "My trips",
  description: "Plan day-by-day Ghana itineraries — attractions, food stops, transport and notes.",
};

export default function TripsLayout({ children }: { children: ReactNode }) {
  return <TripsAuthGate>{children}</TripsAuthGate>;
}
