"use client";

import { useEffect, useState } from "react";
import { BellRing, BadgeCheck, MailWarning } from "lucide-react";

import { api } from "@/lib/api";
import type { SessionUser } from "@travelghana/types";

/**
 * Minimal "My TravelGhana" shell (§19). Full dashboard (trips, itinerary,
 * bookings, saved places) arrives with the trips increment.
 */
export default function AccountPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [state, setState] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => {
        window.location.href = "/login";
      })
      .finally(() => setState("ready"));
  }, []);

  if (state === "loading") {
    return <main className="flex min-h-dvh items-center justify-center text-muted-foreground">Loading…</main>;
  }

  if (!user) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-secondary">My TravelGhana</p>
      <h1 className="mt-1 font-display text-4xl">Akwaaba, {user.name ?? user.email}</h1>

      <div className="mt-8 flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-card border border-border bg-card p-5">
          {user.emailVerified ? (
            <>
              <BadgeCheck aria-hidden className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Email verified</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </>
          ) : (
            <>
              <MailWarning aria-hidden className="h-6 w-6 text-secondary" />
              <div className="flex-1">
                <p className="font-medium">Verify your email</p>
                <p className="text-sm text-muted-foreground">
                  Check your inbox for the verification link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void api.resendVerification()}
                className="rounded-card border border-primary px-4 py-2 text-sm font-medium text-primary"
              >
                Resend
              </button>
            </>
          )}
        </div>

        <div className="rounded-card border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-medium">
            <BellRing aria-hidden className="h-5 w-5 text-primary" /> Roles on this account
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <li key={role} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                {role}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={async () => {
            await api.logout().catch(() => undefined);
            window.location.href = "/";
          }}
          className="self-start rounded-card border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Log out
        </button>
      </div>
    </main>
  );
}
