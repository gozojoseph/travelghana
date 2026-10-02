"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api, ApiClientError, validationIssues } from "@/lib/api";

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (password.length < 10) {
      setFieldError("Password must be at least 10 characters");
      return;
    }

    setPending(true);
    try {
      await api.resetPassword(token, password);
      router.push("/login?reset=1");
    } catch (err) {
      if (err instanceof ApiClientError) {
        const issues = validationIssues(err);
        setError(issues[0]?.message ?? err.message);
      } else {
        setError("Network error — is the API running?");
      }
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="font-display text-3xl">Choose a new password</h1>
      {!token && (
        <p className="mt-4 rounded-card bg-accent/10 px-4 py-3 text-sm text-accent">
          This link is missing its token. Request a new reset link.
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            placeholder="At least 10 characters"
            className="w-full rounded-card border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
          />
          {fieldError && <p className="mt-1 text-xs text-accent">{fieldError}</p>}
        </div>
        {error && (
          <p role="alert" className="rounded-card bg-accent/10 px-4 py-3 text-sm text-accent">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || !token}
          className="rounded-card bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-60"
        >
          Update password
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
