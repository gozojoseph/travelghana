"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

import { api, ApiClientError, validationIssues } from "@/lib/api";

const inputClass =
  "w-full rounded-card border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary";

const SuccessPanel = () => (
  <div className="text-center">
    <CheckCircle2 aria-hidden className="mx-auto h-12 w-12 text-primary" />
    <h1 className="mt-4 font-display text-3xl">Email verified</h1>
    <p className="mt-2 text-sm text-muted-foreground">
      Your email is confirmed. You&apos;re all set to plan your trip.
    </p>
    <Link
      href="/"
      className="mt-6 inline-block rounded-card bg-primary px-6 py-3 font-semibold text-primary-foreground"
    >
      Continue
    </Link>
  </div>
);

const ErrorPanel = ({ message }: { message: string }) => (
  <div className="text-center">
    <XCircle aria-hidden className="mx-auto h-12 w-12 text-accent" />
    <h1 className="mt-4 font-display text-3xl">Not verified</h1>
    <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    <p className="mt-6 text-sm">
      <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
        Back to log in
      </Link>
    </p>
  </div>
);

/** No token in the URL: the user proves themselves with email + 6-digit code. */
function CodeMode() {
  const [state, setState] = useState<"form" | "success" | "error">("form");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const code = String(data.get("code") ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      setMessage("Enter the 6-digit code from your email.");
      setState("error");
      return;
    }
    setMessage("");
    try {
      await api.verifyEmailByCode(email, code);
      setState("success");
    } catch (err) {
      if (err instanceof ApiClientError) {
        const issues = validationIssues(err);
        setMessage(issues[0]?.message ?? err.message);
      } else {
        setMessage("Network error — is the API running?");
      }
      setState("error");
    }
  }

  if (state === "success") return <SuccessPanel />;

  return (
    <div>
      <div className="text-center">
        <h1 className="font-display text-3xl">Verify your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open the email we sent you and enter its 6-digit code below — no link needed.
        </p>
      </div>
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
        {state === "error" && (
          <p role="alert" className="rounded-card bg-accent/10 px-4 py-3 text-sm text-accent">
            {message}
          </p>
        )}
        <button
          type="submit"
          className="rounded-card bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          Verify email
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}

/** Deep link from the email: auto-verify with the single-use token. */
function LinkMode({ token }: { token: string }) {
  const attempted = useRef(false);
  const [state, setState] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    api
      .verifyEmail(token)
      .then(() => setState("success"))
      .catch((err: unknown) => {
        setState("error");
        setMessage(err instanceof ApiClientError ? err.message : "Verification failed.");
      });
  }, [token]);

  if (state === "success") return <SuccessPanel />;
  if (state === "pending") return <p className="text-center text-muted-foreground">Verifying your email…</p>;
  return <ErrorPanel message={message} />;
}

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  return token ? <LinkMode token={token} /> : <CodeMode />;
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <Suspense fallback={null}>
        <VerifyEmailInner />
      </Suspense>
    </main>
  );
}
