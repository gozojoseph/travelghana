"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { api, ApiClientError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Network error — is the API running?");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="font-display text-3xl">Reset your password</h1>
        {sent ? (
          <div className="mt-4 rounded-card bg-muted px-4 py-3 text-sm">
            <p>
              If an account exists for that email, a password-reset email is on
              its way. The link and the 6-digit code inside both expire in 1 hour.
            </p>
            <p className="mt-2">
              If the link does not open, paste the code from the email directly:{" "}
              <Link href="/reset-password" className="font-medium text-primary underline-offset-4 hover:underline">
                Enter the 6-digit code
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-card border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </div>
            {error && (
              <p role="alert" className="rounded-card bg-accent/10 px-4 py-3 text-sm text-accent">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="rounded-card bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-60"
            >
              Send reset link
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
