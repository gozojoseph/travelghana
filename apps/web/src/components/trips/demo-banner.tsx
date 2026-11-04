"use client";

import { FlaskConical, RotateCcw } from "lucide-react";

import { isDemoTrips, resetDemoTrips } from "@/lib/trips";

/**
 * Phase A only: makes it unmistakable that trips are sample data stored in the
 * browser, and offers a one-click restore of the fixtures.
 */
export function DemoBanner({ onReset }: { onReset?: () => void }) {
  if (!isDemoTrips) return null;

  return (
    <div className="animate-rise mb-6 flex flex-col gap-3 rounded-card border border-secondary/70 bg-secondary/20 px-4 py-3 text-sm sm:flex-row sm:items-center">
      <FlaskConical aria-hidden className="h-5 w-5 shrink-0 text-primary" />
      <p className="flex-1 text-muted-foreground">
        <span className="font-medium text-foreground">Preview mode.</span> These sample trips live
        only in this browser. The connected planner keeps trips in your account.
      </p>
      <button
        type="button"
        onClick={() => {
          resetDemoTrips();
          onReset?.();
        }}
        className="inline-flex items-center gap-2 self-start rounded-card border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-95 sm:self-auto"
      >
        <RotateCcw aria-hidden className="h-3.5 w-3.5" />
        Reset demo data
      </button>
    </div>
  );
}
