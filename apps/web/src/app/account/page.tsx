"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  BellRing,
  CalendarCheck,
  Car,
  Loader2,
  MailWarning,
  Route,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { api } from "@/lib/api";
import { FormFeedback } from "@/components/admin/shared";
import type {
  ListingRequest,
  PackageBookingWithPackage,
  SessionUser,
  UserCounts,
} from "@travelghana/types";

const BOOKING_STATUS_CHIP: Record<string, string> = {
  PENDING_PAYMENT: "bg-muted text-muted-foreground",
  CONFIRMED: "bg-primary/10 text-primary",
  COMPLETED: "bg-primary/10 text-primary",
  CANCELLED: "bg-accent/10 text-accent",
  REFUNDED: "bg-accent/10 text-accent",
  EXPIRED: "bg-muted text-muted-foreground",
};

function formatStartDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const TRANSPORT_STATUS_CHIP: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  CONFIRMED: "bg-primary/10 text-primary",
  CANCELLED: "bg-accent/10 text-accent",
};

/** Small count bubble for "info for you" badges (D27). Hidden when empty. */
function CountBadge({ value }: { value: number | null | undefined }) {
  if (typeof value !== "number" || value === 0) return null;
  return (
    <span
      aria-hidden
      className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground"
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

/**
 * Minimal "My TravelGhana" shell (§19). Bookings and saved places arrive in
 * later increments; trips are live in the planner.
 */
export default function AccountPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [bookings, setBookings] = useState<PackageBookingWithPackage[] | null>(null);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [transport, setTransport] = useState<ListingRequest[] | null>(null);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [counts, setCounts] = useState<UserCounts | null>(null);
  const [notifUnread, setNotifUnread] = useState<number | null>(null);
  const [showAdminNotice] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("notice") === "admin-only";
  });

  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => {
        window.location.href = "/login";
      })
      .finally(() => setState("ready"));
  }, []);

  // The traveler's own package booking requests (D26). Loads independently of
  // the profile card so one failure does not blank the page.
  useEffect(() => {
    let active = true;
    api
      .myBookings()
      .then((res) => {
        if (active) {
          setBookings(res.items);
          setBookingsError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setBookings([]);
          setBookingsError(err instanceof Error ? err.message : "Could not load your bookings.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // The traveler's own transport requests (D43); same independence rules.
  useEffect(() => {
    let active = true;
    api
      .myListingRequests()
      .then((res) => {
        if (active) {
          setTransport(res.items);
          setTransportError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setTransport([]);
          setTransportError(
            err instanceof Error ? err.message : "Could not load your transport requests.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // The signed-in member's aggregate counts for the card badges (D27);
  // independent of the lists so a slow list never blanks a badge.
  useEffect(() => {
    let active = true;
    api
      .userCounts()
      .then(({ counts: next }) => {
        if (active) setCounts(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Unread inbox count (D40); same independence rules as the other badges.
  useEffect(() => {
    let active = true;
    api
      .notificationsUnread()
      .then(({ unread }) => {
        if (active) setNotifUnread(unread);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
        <Logo className="h-12 w-auto" alt="" />
        <Loader2 aria-hidden className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm" role="status">
          Loading…
        </p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
        My TravelGhana
      </p>
      <h1 className="animate-rise mt-1 font-display text-4xl [animation-delay:60ms]">
        Akwaaba, {user.name ?? user.email}
      </h1>

      {showAdminNotice && !user.roles.includes("ADMIN") ? (
        <div
          role="status"
          className="animate-rise mt-6 flex items-start gap-3 rounded-card border border-secondary/40 bg-secondary/10 p-4 [animation-delay:40ms]"
        >
          <ShieldAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
          <div>
            <p className="text-sm font-medium">Admin access required</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              The admin console is limited to TravelGhana staff accounts.
            </p>
          </div>
        </div>
      ) : null}

      <div className="tg-stagger mt-8 flex flex-col gap-4">
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
                className="rounded-card border border-primary px-4 py-2 text-sm font-medium text-primary transition-[background-color,transform] duration-150 hover:bg-primary/5 active:scale-[0.98]"
              >
                Resend
              </button>
            </>
          )}
        </div>

        <Link
          href="/trips"
          className="flex items-center gap-3 rounded-card border border-border bg-card p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary active:translate-y-0"
        >
          <Route aria-hidden className="h-6 w-6 text-primary" />
          <div>
            <p className="flex items-center gap-2 font-medium">
              My trips
              <CountBadge value={counts?.trips} />
            </p>
            <p className="text-sm text-muted-foreground">
              Plan and manage your day-by-day Ghana itineraries.
            </p>
          </div>
        </Link>

        <Link
          href="/account/notifications"
          className="flex items-center gap-3 rounded-card border border-border bg-card p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary active:translate-y-0"
        >
          <BellRing aria-hidden className="h-6 w-6 text-primary" />
          <div>
            <p className="flex items-center gap-2 font-medium">
              Notifications
              <CountBadge value={notifUnread} />
            </p>
            <p className="text-sm text-muted-foreground">
              Booking updates and notes from the team, in one place.
            </p>
          </div>
        </Link>

        <div className="rounded-card border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-medium">
            <CalendarCheck aria-hidden className="h-5 w-5 text-primary" /> My bookings
            <CountBadge value={counts?.packageBookings} />
          </p>

          <div className="mt-2">
            <FormFeedback message={bookingsError} />
          </div>

          {bookings === null ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Loading your bookings…
            </p>
          ) : null}

          {bookings !== null && bookings.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No booking requests yet.{" "}
              <Link
                href="/packages"
                className="font-medium text-primary hover:underline"
              >
                Browse our created journeys
              </Link>{" "}
              to book one.
            </p>
          ) : null}

          {bookings !== null && bookings.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-3">
              {bookings.map((booking) => (
                <li key={booking.id} className="rounded-card border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-sm font-semibold">{booking.code}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        BOOKING_STATUS_CHIP[booking.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {booking.status.replace("_", " ").toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    <Link
                      href={`/packages/${booking.package.slug}`}
                      className="hover:text-primary hover:underline"
                    >
                      {booking.package.title}
                    </Link>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Starts{" "}
                    {formatStartDate(booking.startDate)} · {booking.adults}{" "}
                    {booking.adults === 1 ? "adult" : "adults"}
                    {booking.children > 0
                      ? `, ${booking.children} ${booking.children === 1 ? "child" : "children"}`
                      : ""}
                  </p>
                  {booking.status === "PENDING_PAYMENT" ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No payment has been taken - the team confirms availability first.
                    </p>
                  ) : null}
                  {booking.status === "CONFIRMED" && booking.paidAt ? (
                    <p className="mt-1 text-xs font-medium text-primary">
                      Payment received {formatStartDate(booking.paidAt)} - all set.
                    </p>
                  ) : null}
                  {booking.status === "CONFIRMED" ? (
                    <p className="mt-2 text-xs">
                      <Link
                        href={`/packages/${booking.package.slug}#review`}
                        className="font-medium text-primary hover:underline"
                      >
                        Review this journey
                      </Link>
                      <span className="text-muted-foreground">
                        {" "}- share your experience (moderated before it shows).
                      </span>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="rounded-card border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-medium">
            <Car aria-hidden className="h-5 w-5 text-primary" /> Transport requests
            <CountBadge value={transport?.length} />
          </p>

          <div className="mt-2">
            <FormFeedback message={transportError} />
          </div>

          {transport === null ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Loading your transport
              requests…
            </p>
          ) : null}

          {transport !== null && transport.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No transport requests yet.{" "}
              <Link href="/transport" className="font-medium text-primary hover:underline">
                See who drives
              </Link>{" "}
              and ask for a quote.
            </p>
          ) : null}

          {transport !== null && transport.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-3">
              {transport.map((request) => (
                <li key={request.id} className="rounded-card border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-sm font-semibold">{request.code}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        TRANSPORT_STATUS_CHIP[request.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {request.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{request.listing.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {request.listing.provider.name} · Starts{" "}
                    {formatStartDate(request.startDate)} · {request.partySize}{" "}
                    {request.partySize === 1 ? "traveler" : "travelers"}
                  </p>
                  {request.status === "PENDING" ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Waiting for the team to reply with a quote.
                    </p>
                  ) : null}
                  {request.quoteNote ? (
                    <div className="mt-2 rounded-card border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        The team&apos;s quote
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm">{request.quoteNote}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {user.roles.includes("ADMIN") ? (
          <Link
            href="/admin/packages"
            className="flex items-center gap-3 rounded-card border border-border bg-card p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary active:translate-y-0"
          >
            <ShieldCheck aria-hidden className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium">Admin console</p>
              <p className="text-sm text-muted-foreground">
                Curate packages and manage platform content.
              </p>
            </div>
          </Link>
        ) : null}

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
          className="self-start rounded-card border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-[0.98]"
        >
          Log out
        </button>
      </div>
    </main>
  );
}
