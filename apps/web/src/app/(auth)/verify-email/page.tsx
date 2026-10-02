"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

import { api, ApiClientError } from "@/lib/api";

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const attempted = useRef(false);

  const [state, setState] = useState<"pending" | "success" | "error">(
    token ? "pending" : "error",
  );
  const [message, setMessage] = useState(token ? "" : "This link is missing its token.");

  useEffect(() => {
    if (!token) return;
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

  return (
    <div className="w-full max-w-md text-center">
      {state === "pending" && <p className="text-muted-foreground">Verifying your email…</p>}
      {state === "success" && (
        <>
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
        </>
      )}
      {state === "error" && (
        <>
          <XCircle aria-hidden className="mx-auto h-12 w-12 text-accent" />
          <h1 className="mt-4 font-display text-3xl">Link not valid</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <p className="mt-6 text-sm">
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Back to log in
            </Link>
          </p>
        </>
      )}
    </div>
  );
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
