"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { api } from "@/lib/api";
import { isDemoTrips } from "@/lib/trips";

/**
 * Protects the trip planner when it is backed by the API (Phase C).
 *
 * Demo mode (the browser-only preview) stays open on purpose — that is the
 * frontend-first seam from Phase A. In API mode a missing/expired session is
 * sent to the login page and returned to the same trip afterwards.
 */
export function TripsAuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ready">(
    isDemoTrips ? "ready" : "checking",
  );

  useEffect(() => {
    if (isDemoTrips) return;

    let active = true;
    api
      .me()
      .then(() => {
        if (active) setState("ready");
      })
      .catch(() => {
        if (!active) return;
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
      });

    return () => {
      active = false;
    };
  }, []);

  if (state === "checking") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
        <Logo className="h-12 w-auto" alt="" />
        <Loader2 aria-hidden className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm" role="status">
          Checking your session…
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
