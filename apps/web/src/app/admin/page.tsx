"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  CalendarCheck,
  Car,
  Inbox,
  Library,
  LineChart,
  MapPinned,
  Package as PackageIcon,
  ScrollText,
  Star,
  Users,
} from "lucide-react";
import type { AdminStats } from "@travelghana/types";

import { api, ApiClientError } from "@/lib/api";
import { formatDateTime } from "@/components/admin/shared";

/**
 * Dashboard home (D20). Every KPI card maps to a shipped section of the
 * console — none of the counters are placeholders, so the numbers always
 * mean something actionable.
 */
export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .adminStats()
      .then(({ stats: data }) => {
        if (!active) return;
        setStats(data);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiClientError && err.status === 403
            ? "Admin access is required."
            : err instanceof Error
              ? err.message
              : "Could not load the dashboard.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  const cards: Array<{
    label: string;
    value: number | null;
    hint: string;
    href: string;
    icon: typeof Inbox;
    tone?: "pending" | "info";
  }> = [
    {
      label: "Listings in review",
      value: stats?.counts.listingsPendingReview ?? null,
      hint: "Waiting for an approve / reject decision",
      href: "/admin/listings",
      icon: MapPinned,
      tone: "pending",
    },
    {
      label: "Booking requests",
      value: stats?.counts.packageBookingsPending ?? null,
      hint: "Package bookings awaiting availability confirmation",
      href: "/admin/bookings",
      icon: CalendarCheck,
      tone: "pending",
    },
    {
      label: "Transport requests",
      value: stats?.counts.listingRequestsPending ?? null,
      hint: "Travelers waiting for a written quote",
      href: "/admin/transport",
      icon: Car,
      tone: "pending",
    },
    {
      label: "Reviews in queue",
      value: stats?.counts.reviewsPending ?? null,
      hint: "Package reviews waiting for moderation",
      href: "/admin/reviews",
      icon: Star,
      tone: "pending",
    },
    {
      label: "New enquiries",
      value: stats?.counts.enquiriesNew ?? null,
      hint: "Unopened entries in the concierge queue",
      href: "/admin/enquiries",
      icon: Inbox,
      tone: "pending",
    },
    {
      label: "Unverified providers",
      value: stats?.counts.providersUnverified ?? null,
      hint: "Operators waiting for verification",
      href: "/admin/providers",
      icon: Building2,
      tone: "pending",
    },
    {
      label: "Unpublished catalog",
      value:
        stats === null
          ? null
          : stats.counts.destinationsUnpublished + stats.counts.attractionsUnpublished,
      hint: "Destinations + attractions not yet public",
      href: "/admin/catalog",
      icon: Library,
      tone: "pending",
    },
    {
      label: "Draft packages",
      value: stats?.counts.packagesDraft ?? null,
      hint: "Created but not published yet",
      href: "/admin/packages",
      icon: PackageIcon,
      tone: "info",
    },
    {
      label: "Queued notifications",
      value: stats?.counts.notificationsQueued ?? null,
      hint: "Outbox records — no provider wired yet",
      href: "/admin/notifications",
      icon: Bell,
      tone: "info",
    },
    {
      label: "Active users",
      value: stats?.counts.usersActive ?? null,
      hint: "Accounts not suspended",
      href: "/admin/users",
      icon: Users,
      tone: "info",
    },
  ];

  // Enquiries also get an "unassigned" KPI — only meaningful beyond NEW.
  const unassigned = stats?.counts.enquiriesUnassignedActive ?? null;
  const enquiriesNew = stats?.counts.enquiriesNew ?? null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What needs an admin decision right now.
            {stats ? <span> Generated at {formatDateTime(stats.generatedAt)}.</span> : null}
          </p>
        </div>
      </header>

      {error ? (
        <p role="alert" className="mt-6 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section aria-label="Key counters" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, hint, href, icon: Icon, tone }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-card border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <Icon aria-hidden className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </div>
            <p
              className={`mt-2 font-display text-3xl ${
                value === null
                  ? "text-muted-foreground/40"
                  : tone === "pending" && value > 0
                    ? "text-primary"
                    : ""
              }`}
            >
              {value === null ? "…" : value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </Link>
        ))}
      </section>

      {enquiriesNew !== null && unassigned !== null ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {unassigned} active {unassigned === 1 ? "enquiry is" : "enquiries are"} still unassigned
          ({enquiriesNew} new).{" "}
          <Link href="/admin/enquiries" className="text-primary hover:underline">
            Open the queue
          </Link>
          .
        </p>
      ) : null}

      <VisitorSessionsCard />

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="rounded-card border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Listings awaiting review</h2>
            <Link href="/admin/listings" className="text-xs text-primary hover:underline">
              Review
            </Link>
          </div>
          <RecentListings items={stats?.recent.listings ?? null} />
        </div>

        <div className="rounded-card border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Latest enquiries</h2>
            <Link href="/admin/enquiries" className="text-xs text-primary hover:underline">
              Queue
            </Link>
          </div>
          <RecentEnquiries items={stats?.recent.enquiries ?? null} />
        </div>

        <div className="rounded-card border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <Link href="/admin/activity" className="text-xs text-primary hover:underline">
              Trail
            </Link>
          </div>
          <RecentActivity items={stats?.recent.audit ?? null} />
        </div>
      </section>
    </main>
  );
}

function RecentListings({
  items,
}: {
  items: Array<{ id: string; title: string; providerName: string; createdAt: string }> | null;
}) {
  if (items === null) return <PendingRows />;
  if (items.length === 0) {
    return <EmptyNote text="Nothing in the review queue right now." />;
  }
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.id} className="truncate">
          <span className="font-medium">{item.title}</span>
          <span className="text-muted-foreground"> · {item.providerName}</span>
          <span className="block text-xs text-muted-foreground">
            {formatDateTime(item.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RecentEnquiries({
  items,
}: {
  items: Array<{ id: string; code: string; name: string; status: string; createdAt: string }> | null;
}) {
  if (items === null) return <PendingRows />;
  if (items.length === 0) {
    return <EmptyNote text="No enquiries yet." />;
  }
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.id} className="truncate">
          <span className="font-medium">{item.code}</span>
          <span className="text-muted-foreground"> · {item.name}</span>
          <span className="block text-xs text-muted-foreground">
            {item.status} · {formatDateTime(item.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RecentActivity({
  items,
}: {
  items: Array<{ id: string; action: string; entityType: string; actorEmail: string | null; createdAt: string }> | null;
}) {
  if (items === null) return <PendingRows />;
  if (items.length === 0) {
    return <EmptyNote text="No activity recorded yet." />;
  }
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.id} className="truncate">
          <span className="font-medium">{item.action.toLowerCase()}</span>
          <span className="text-muted-foreground">
            {" "}
            on {item.entityType}
            {item.actorEmail ? ` · ${item.actorEmail}` : ""}
          </span>
          <span className="block text-xs text-muted-foreground">
            {formatDateTime(item.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PendingRows() {
  return (
    <div className="mt-3 space-y-2" role="status">
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-8 w-full animate-pulse rounded-card bg-muted/60" />
      ))}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
      <ScrollText aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      {text}
    </p>
  );
}

/** D37: 24h session count + link into the visitor insights console. */
function VisitorSessionsCard() {
  const [sessions, setSessions] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    api
      .adminInsights("24h")
      .then((data) => {
        if (active) setSessions(data.kpis.sessions);
      })
      .catch(() => {
        if (active) setSessions(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Link
      href="/admin/insights"
      className="group mt-4 flex items-center justify-between gap-4 rounded-card border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Visitor sessions (24h)
        </p>
        <p className="mt-1 font-display text-3xl">{sessions === null ? "…" : sessions}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          First-party clickstream - funnel, sources, devices and session timelines in Insights.
        </p>
      </div>
      <LineChart aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
    </Link>
  );
}
