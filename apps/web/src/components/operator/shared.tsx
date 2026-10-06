"use client";

import type { ReactNode } from "react";

import { ApiClientError, validationIssues } from "@/lib/api";

/** Small shared building blocks for operator forms (same visual language as
 * the auth forms): field wrapper, inline errors, and submit-state handling. */
export const inputClass =
  "w-full rounded-card border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

export const buttonClass =
  "rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50";

export function Field({
  label,
  error,
  children,
  hint,
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
    <p role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </p>
  );
}

/** Wraps a submit action with pending state and zod-issue → field-error mapping. */
export async function submitForm(
  action: () => Promise<void>,
  setState: (s: { pending: boolean; formError: string | null; fieldErrors: Record<string, string> }) => void,
): Promise<void> {
  setState({ pending: true, formError: null, fieldErrors: {} });
  try {
    await action();
  } catch (err) {
    if (err instanceof ApiClientError) {
      const issues = validationIssues(err);
      if (issues.length > 0) {
        const map: Record<string, string> = {};
        for (const issue of issues) map[issue.path] = issue.message;
        setState({ pending: false, formError: null, fieldErrors: map });
        return;
      }
      setState({ pending: false, formError: err.message, fieldErrors: {} });
      return;
    }
    setState({ pending: false, formError: "Network error — is the API running?", fieldErrors: {} });
  }
}

/**
 * Load-time 401 → login, missing provider/role → operator home; anything else
 * surfaces as an error state in the page.
 */
export function handleLoadError(err: unknown): "login" | "operator" | "error" {
  if (err instanceof ApiClientError) {
    if (err.status === 401) {
      window.location.href = "/login";
      return "login";
    }
    if (err.status === 403 || err.status === 404) {
      window.location.href = "/operator";
      return "operator";
    }
  }
  return "error";
}

/** GHS display input ↔ integer minor units (D8: pesewas never leak to the UI). */
export function toMinorUnits(cedis: string): number {
  return Math.round(Number.parseFloat(cedis) * 100);
}

export function toCedisDisplay(minor: number): string {
  return (minor / 100).toFixed(2);
}
