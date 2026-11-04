"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { api, ApiClientError, validationIssues } from "@/lib/api";

type Mode = "login" | "register";

/**
 * Only same-origin paths are accepted, so `?next=` cannot become an open
 * redirect. Absolute URLs (including protocol-relative `//host`) fall back.
 */
function nextPath(fallback = "/account"): string {
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Shared auth form (§52 reusable components). Client-side zod-equivalent checks
 * are minimal — the API validates with the same shared schemas and errors are
 * surfaced inline.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "");
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    try {
      if (mode === "register") {
        await api.register({ name, email, password });
      } else {
        await api.login({ email, password });
      }
      window.location.href = nextPath();
    } catch (err) {
      if (err instanceof ApiClientError) {
        const issues = validationIssues(err);
        if (issues.length > 0) {
          const map: Record<string, string> = {};
          for (const issue of issues) map[issue.path] = issue.message;
          setFieldErrors(map);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Network error — is the API running?");
      }
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-card border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

  return (
    <div className="animate-rise mx-auto w-full max-w-md">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <Logo className="h-16 w-auto" />
        <h1 className="font-display text-3xl">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "login"
            ? "Log in to plan and manage your Ghana trip."
            : "Start planning your journey across Ghana."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {mode === "register" && (
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              placeholder="Ama Mensah"
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-accent">{fieldErrors.name}</p>}
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-accent">{fieldErrors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "register" ? 10 : 1}
            placeholder={mode === "register" ? "At least 10 characters" : "Your password"}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-accent">{fieldErrors.password}</p>
          )}
        </div>

        {formError && (
          <p role="alert" className="animate-pop rounded-card bg-accent/10 px-4 py-3 text-sm text-accent">
            {formError}
          </p>
        )}

        {mode === "login" && (
          <div className="-mt-2 flex justify-end">
            <a
              href="/forgot-password"
              className="text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              Forgot your password?
            </a>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-card bg-primary px-6 py-3 font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
        >
          {pending && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
          {mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New to TravelGhana?{" "}
            <a href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Create an account
            </a>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <a href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Log in
            </a>
          </>
        )}
      </p>
    </div>
  );
}
