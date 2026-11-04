"use client";

import type { ReactNode } from "react";

/** Generic form primitives shared by the planner and admin screens. */

export const inputClass =
  "w-full rounded-card border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

export const buttonClass =
  "rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50";

export const secondaryButtonClass =
  "rounded-card border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-[0.98] disabled:opacity-50";

export const dangerButtonClass =
  "rounded-card border border-accent/40 px-4 py-2 text-sm font-medium text-accent transition-[color,background-color,transform] duration-150 hover:bg-accent/10 active:scale-[0.98] disabled:opacity-50";

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint !== undefined && !error ? (
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      ) : null}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

export function FormFeedback({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="animate-pop rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </p>
  );
}

export interface ValidationIssueLike {
  path: (string | number)[];
  message: string;
}

/** Maps zod-style issues to a flat `{ field: message }` record for inline errors. */
export function issueMap(issues: readonly ValidationIssueLike[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of issues) map[issue.path.join(".")] = issue.message;
  return map;
}
