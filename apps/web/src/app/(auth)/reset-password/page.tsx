"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api, ApiClientError, validationIssues } from "@/lib/api";

const inputClass =
  "w-full rounded-card border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary";

function LinkMode({ token }: { token: string }) {
  const router = useRouter();
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
            className={inputClass}
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
          disabled={pending}
          className="rounded-card bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-60"
        >
          Update password
        </button>
      </form>
    </div>
  );
}

/** No token in the URL: enter your email, the 6-digit code, and a new password. */
function CodeMode() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const code = String(data.get("code") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters");
      return;
    }
    setPending(true);
    try {
      await api.resetPasswordByCode(email, code, password);
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
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the email and the 6-digit code from the reset email — no link needed.
      </p>
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
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="code" className="mb-1.5 block text-sm font-medium">
            6-digit code
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="123456"
            className={`${inputClass} text-center text-lg tracking-[0.4em]`}
          />
        </div>
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
            className={inputClass}
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
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <a href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
          Request a new code
        </a>
      </p>
    </div>
  );
}

function ResetPasswordInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  return token ? <LinkMode token={token} /> : <CodeMode />;
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <Suspense fallback={null}>
        <ResetPasswordInner />
      </Suspense>
    </main>
  );
}
