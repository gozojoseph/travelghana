"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  BellRing,
  CalendarCheck,
  Check,
  Loader2,
  MailWarning,
  Sparkles,
  X,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { FormFeedback } from "@/components/admin/shared";
import { api } from "@/lib/api";
import type {
  TravelerNotificationDto,
  TravelerNotificationsResult,
} from "@travelghana/types";

/**
 * Traveler inbox (D40): the member-facing view of the same Notification rows
 * the platform writes for booking lifecycle events and team outreach
 * (D34/D36). Emails keep going out exactly as before; this is the "you were
 * notified" trail inside the app, with read state the traveler controls.
 */

const NOTIFICATION_CONTENT: Record<string, { title: string; body: string }> = {
  PACKAGE_BOOKING_REQUESTED: {
    title: "Booking request received",
    body: "Your request is in. The team confirms availability next.",
  },
  PACKAGE_BOOKING_ACKNOWLEDGED: {
    title: "We are looking after your booking",
    body: "The team acknowledged your request and will follow up.",
  },
  PACKAGE_BOOKING_CONCERN: {
    title: "A note from our team",
    body: "The team sent you a question or note - check your email.",
  },
  PACKAGE_BOOKING_CONFIRMED: {
    title: "Booking confirmed",
    body: "Your journey is confirmed. Check your email for payment details.",
  },
  PACKAGE_BOOKING_CANCELLED: {
    title: "Booking cancelled",
    body: "This booking was cancelled. Check your email for the reason.",
  },
  PROVIDER_VERIFICATION: {
    title: "Provider verification update",
    body: "Your provider verification status changed.",
  },
};

function contentFor(type: string): { title: string; body: string } {
  return (
    NOTIFICATION_CONTENT[type] ?? {
      title: type.charAt(0) + type.slice(1).replace(/_/g, " ").toLowerCase(),
      body: "See your email for the details.",
    }
  );
}

function iconFor(type: string) {
  if (type === "PACKAGE_BOOKING_REQUESTED") return CalendarCheck;
  if (type === "PACKAGE_BOOKING_CONFIRMED" || type === "PROVIDER_VERIFICATION")
    return BadgeCheck;
  if (type === "PACKAGE_BOOKING_CANCELLED") return X;
  if (type === "PACKAGE_BOOKING_CONCERN") return MailWarning;
  return BellRing;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Booking code out of the row payload when the platform included one. */
function codeFor(notification: TravelerNotificationDto): string | null {
  const payload = notification.payload;
  if (payload && typeof payload === "object" && "code" in payload) {
    const code = (payload as Record<string, unknown>).code;
    if (typeof code === "string" && code.length > 0) return code;
  }
  return null;
}

export default function InboxPage() {
  const [user, setUser] = useState<boolean | null>(null);
  const [items, setItems] = useState<TravelerNotificationDto[] | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(() => setUser(true))
      .catch(() => {
        window.location.href = "/login";
        setUser(false);
      });
  }, []);

  async function load(nextPage: number, append: boolean) {
    try {
      const res: TravelerNotificationsResult = await api.notifications(nextPage);
      setItems((prev) => (append && prev ? [...prev, ...res.items] : res.items));
      setPage(res.page);
      setPages(res.pages);
      setUnread(res.unread);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your notifications.");
    }
  }

  useEffect(() => {
    if (!user) return;
    api
      .notifications(1)
      .then((res) => {
        setItems(res.items);
        setPage(res.page);
        setPages(res.pages);
        setUnread(res.unread);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load your notifications.");
      });
  }, [user]);

  if (user === null) {
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

  async function markOne(notification: TravelerNotificationDto) {
    if (notification.readAt) return;
    setBusyId(notification.id);
    try {
      const { notification: updated } = await api.markNotificationRead(notification.id);
      setItems((prev) =>
        prev
          ? prev.map((item) => (item.id === updated.id ? { ...item, readAt: updated.readAt } : item))
          : prev,
      );
      setUnread((n) => Math.max(0, n - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark that as read.");
    } finally {
      setBusyId(null);
    }
  }

  async function markAll() {
    if (unread === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      const readAt = new Date().toISOString();
      await api.markAllNotificationsRead();
      setItems((prev) =>
        prev
          ? prev.map((item) => (item.readAt ? item : { ...item, readAt }))
          : prev,
      );
      setUnread(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark everything as read.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
        My TravelGhana
      </p>
      <div className="animate-rise mt-1 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl">Notifications</h1>
        {unread > 0 ? (
          <button
            type="button"
            onClick={() => void markAll()}
            disabled={bulkBusy}
            className="inline-flex items-center gap-2 rounded-card border border-primary px-4 py-2 text-sm font-medium text-primary transition-[background-color,transform] duration-150 hover:bg-primary/5 active:scale-[0.98] disabled:opacity-60"
          >
            {bulkBusy ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Check aria-hidden className="h-4 w-4" />
            )}
            Mark all read ({unread})
          </button>
        ) : null}
      </div>
      <p className="animate-rise mt-2 text-sm text-muted-foreground">
        Everything the platform has told you about your journeys - the same updates
        that also go to your email.
      </p>

      <div className="mt-6">
        <FormFeedback message={error} />
      </div>

      {items === null ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Loading your
          notifications…
        </p>
      ) : null}

      {items !== null && items.length === 0 ? (
        <div className="tg-stagger mt-8 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-card p-10 text-center">
            <BellRing aria-hidden className="h-8 w-8 text-primary" />
            <p className="font-medium">Nothing here yet</p>
            <p className="text-sm text-muted-foreground">
              Booking updates and notes from the team will land here.{" "}
              <Link href="/packages" className="font-medium text-primary hover:underline">
                Browse our journeys
              </Link>{" "}
              to start one.
            </p>
          </div>
        </div>
      ) : null}

      {items !== null && items.length > 0 ? (
        <ul className="tg-stagger mt-8 flex flex-col gap-3">
          {items.map((notification) => {
            const content = contentFor(notification.type);
            const Icon = iconFor(notification.type);
            const code = codeFor(notification);
            const unreadRow = notification.readAt === null;
            return (
              <li
                key={notification.id}
                className={`flex gap-4 rounded-card border bg-card p-5 transition-colors ${
                  unreadRow ? "border-primary/40" : "border-border"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    unreadRow ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`flex flex-wrap items-center gap-2 ${unreadRow ? "font-semibold" : "font-medium"}`}>
                    {content.title}
                    {unreadRow ? (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--tg-text-primary)]">
                        New
                      </span>
                    ) : null}
                    {code ? <span className="font-mono text-xs text-muted-foreground">{code}</span> : null}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{content.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatWhen(notification.sentAt ?? notification.createdAt)}
                  </p>
                </div>
                {unreadRow ? (
                  <button
                    type="button"
                    onClick={() => void markOne(notification)}
                    disabled={busyId === notification.id}
                    className="self-start rounded-card border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-[color,border-color,transform] duration-150 hover:border-primary hover:text-foreground active:scale-[0.98] disabled:opacity-60"
                  >
                    {busyId === notification.id ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Mark read"
                    )}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {items !== null && page < pages ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void load(page + 1, true)}
            className="rounded-card border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-[0.98]"
          >
            Load older notifications
          </button>
        </div>
      ) : null}

      <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles aria-hidden className="h-3.5 w-3.5 text-secondary" /> Emails also
        go out for bookings - this inbox always mirrors them.
      </p>
    </main>
  );
}
