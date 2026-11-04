"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Eye,
  Globe,
  Monitor,
  MousePointerClick,
  Smartphone,
  Tablet,
  Users,
} from "lucide-react";
import type {
  AdminInsightEventDto,
  AdminInsightSessionDetail,
  AdminInsightSessionSummary,
  AdminInsightSessionsResult,
  AdminInsightsResult,
} from "@travelghana/types";

import { api, ApiClientError } from "@/lib/api";
import { formatDateTime } from "@/components/admin/shared";

const RANGES = ["24h", "7d", "30d"] as const;
type Range = (typeof RANGES)[number];

const DEVICE_ICONS: Record<string, typeof Globe> = {
  phone: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  other: Globe,
};

/** "+3m 20s" style gap between two timeline events. */
function gapLabel(fromMs: number, toMs: number): string {
  const total = Math.max(0, Math.round((toMs - fromMs) / 1000));
  if (total < 60) return `+${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `+${minutes}m ${total % 60}s`;
  return `+${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/**
 * Visitor insights (D37). First-party clickstream aggregates from /api/track:
 * KPIs, the visit-to-booking funnel (final step is server-side PackageBooking
 * truth), top content, acquisition origins, devices and a session inspector.
 */
export default function AdminInsightsPage() {
  const [range, setRange] = useState<Range>("7d");
  const [includeAdmins, setIncludeAdmins] = useState(false);
  const [loaded, setLoaded] = useState<{ range: Range; admins: boolean; data: AdminInsightsResult } | null>(null);
  const [sessionsResult, setSessionsResult] = useState<AdminInsightSessionsResult | null>(null);
  const [sessionsTried, setSessionsTried] = useState(false);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminInsightSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Loading is derived (no synchronous setState inside effects): summary stays
  // null between a range switch and the fresh response.
  const summary =
    loaded && loaded.range === range && loaded.admins === includeAdmins ? loaded.data : null;

  useEffect(() => {
    let active = true;
    api
      .adminInsights(range, includeAdmins)
      .then((data) => {
        if (active) {
          setLoaded({ range, admins: includeAdmins, data });
          setError(null);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiClientError && err.status === 403
            ? "Admin access is required."
            : err instanceof Error
              ? err.message
              : "Could not load insights.",
        );
      });
    return () => {
      active = false;
    };
  }, [range, includeAdmins]);

  const loadSessions = useCallback(
    (targetPage: number) => {
      let active = true;
      api
        .adminInsightSessions({ range, includeAdmins, page: targetPage })
        .then((data) => {
          if (active) setSessionsResult(data);
        })
        .catch(() => {
          if (active) setSessionsResult(null);
        })
        .finally(() => {
          if (active) setSessionsTried(true);
        });
      return () => {
        active = false;
      };
    },
    [range, includeAdmins],
  );

  useEffect(() => {
    loadSessions(page);
  }, [loadSessions, page]);

  function toggleSession(item: AdminInsightSessionSummary) {
    if (expanded === item.sessionId) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(item.sessionId);
    setDetail(null);
    api
      .adminInsightSession(item.sessionId)
      .then(setDetail)
      .catch(() => setDetail(null));
  }

  const funnel = summary?.funnel ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Visitor insights</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            First-party clickstream — no third-party trackers. Query strings are
            never stored, referrers are origins only, bots and /admin are
            excluded. Sessions renew after 30 idle minutes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Date range"
            className="flex overflow-hidden rounded-card border border-border"
          >
            {RANGES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={range === option}
                onClick={() => {
                  setRange(option);
                  setPage(1);
                }}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  range === option
                    ? "bg-primary text-white"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-card border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeAdmins}
              onChange={(event) => {
                setIncludeAdmins(event.target.checked);
                setPage(1);
              }}
              className="h-3.5 w-3.5 accent-[var(--primary,#006B3F)]"
            />
            Include admin browsing
          </label>
        </div>
      </header>

      {error ? (
        <p role="alert" className="mt-6 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/* KPIs */}
      <section aria-label="Key visitor numbers" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-card border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visitors</span>
            <Users aria-hidden className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 font-display text-3xl">{summary ? summary.kpis.visitors : "…"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Distinct browsers in range</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sessions</span>
            <Activity aria-hidden className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 font-display text-3xl">{summary ? summary.kpis.sessions : "…"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary ? `${summary.kpis.events} tracked events` : "—"}
          </p>
        </div>
        <div className="rounded-card border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bookings</span>
            <CalendarCheck aria-hidden className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 font-display text-3xl">{summary ? summary.kpis.bookings : "…"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Created in range (server truth)</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Window</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{range}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {summary ? `Since ${formatDateTime(summary.since)}` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary ? `${summary.kpis.sessions} session${summary.kpis.sessions === 1 ? "" : "s"} evaluated` : ""}
          </p>
        </div>
      </section>

      {/* Funnel */}
      <section aria-label="Conversion funnel" className="mt-8 rounded-card border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Funnel — visit to booking</h2>
        {funnel.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {summary === null && error === null
              ? "Loading…"
              : "No tracked traffic yet — browse the public site in another tab, then reload this page."}
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {funnel.map((step, index) => {
              const previous = index > 0 ? funnel[index - 1] : null;
              const lost = previous ? Math.max(0, previous.sessions - step.sessions) : 0;
              return (
                <li key={step.label}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm text-foreground">
                      {index + 1}. {step.label}
                      {lost > 0 ? (
                        <span className="ml-2 text-xs text-muted-foreground">(↓ {lost} before this step)</span>
                      ) : null}
                    </span>
                    <span className="text-sm font-semibold">
                      {step.sessions}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({step.rate}% of visits)
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${Math.min(100, step.rate)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          The first four steps count distinct browser sessions; the final step is
          counted from the bookings table itself, so it cannot be inflated by
          client-side events.
        </p>
      </section>

      {/* Top lists */}
      <section aria-label="Top content and sources" className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-card border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Top paths</h2>
          {summary && summary.topPaths.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {summary.topPaths.map((entry) => (
                <li key={entry.path} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-mono text-xs text-foreground">{entry.path}</span>
                  <span className="text-xs text-muted-foreground">{entry.views}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No page views in range yet.</p>
          )}
        </div>
        <div className="rounded-card border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Where sessions came from</h2>
          {summary && summary.topReferrers.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {summary.topReferrers.map((entry) => (
                <li key={entry.referrer} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-xs text-foreground">{entry.referrer}</span>
                  <span className="text-xs text-muted-foreground">{entry.sessions} sessions</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No arrival sources recorded yet.</p>
          )}
        </div>
        <div className="rounded-card border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Devices</h2>
          {summary && summary.devices.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {summary.devices.map((entry) => {
                const Icon = DEVICE_ICONS[entry.device] ?? Globe;
                return (
                  <li key={entry.device} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-xs text-foreground">
                      <Icon aria-hidden className="h-4 w-4 text-muted-foreground" />
                      {entry.device}
                    </span>
                    <span className="text-xs text-muted-foreground">{entry.sessions} sessions</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No devices recorded yet.</p>
          )}
        </div>
      </section>

      {/* Session inspector */}
      <section aria-label="Sessions" className="mt-6 rounded-card border border-border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Recent sessions</h2>
          {sessionsResult ? (
            <span className="text-xs text-muted-foreground">
              {sessionsResult.total} total · page {sessionsResult.page}/{Math.max(1, sessionsResult.pages)}
            </span>
          ) : null}
        </div>

        {sessionsResult && sessionsResult.items.length > 0 ? (
          <ul className="mt-3 divide-y divide-border">
            {sessionsResult.items.map((item) => {
              const DeviceIcon = DEVICE_ICONS[item.device] ?? Globe;
              const isOpen = expanded === item.sessionId;
              return (
                <li key={item.sessionId}>
                  <button
                    type="button"
                    onClick={() => toggleSession(item)}
                    aria-expanded={isOpen}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-3 text-left text-sm hover:bg-muted/40"
                  >
                    {isOpen ? (
                      <ChevronUp aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="font-mono text-xs text-foreground">{item.sessionId}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <DeviceIcon aria-hidden className="h-3.5 w-3.5" />
                      {item.device}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(item.firstAt)} → {formatDateTime(item.lastAt)}
                    </span>
                    <span className="text-xs text-muted-foreground">{item.events} events</span>
                    <span className="min-w-0 truncate text-xs text-foreground" title={`${item.entryPath} → ${item.lastPath}`}>
                      {item.entryPath} → {item.lastPath}
                    </span>
                    {item.trackedBookings ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        booking actions
                      </span>
                    ) : null}
                    {item.email ? (
                      <span className="text-xs text-muted-foreground">{item.email}</span>
                    ) : null}
                  </button>
                  {isOpen ? (
                    <div className="pb-4">
                      {detail ? (
                        <ol className="mt-1 space-y-1.5 border-l-2 border-primary/30 pl-4">
                          {detail.events.map((event, index) => (
                            <TimelineRow
                              key={event.id}
                              event={event}
                              previousAt={index > 0 ? detail.events[index - 1]?.occurredAt ?? null : null}
                            />
                          ))}
                          <li className="pt-1 text-xs text-muted-foreground">
                            Session ended here — {formatDateTime(detail.events[detail.events.length - 1]?.occurredAt)}.
                          </li>
                        </ol>
                      ) : (
                        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Activity aria-hidden className="h-3.5 w-3.5 animate-pulse" /> Loading timeline…
                        </p>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {sessionsTried === false
              ? "Loading…"
              : "No tracked sessions in this window yet — open the public site in another tab, browse a page or two, then reload."}
          </p>
        )}

        {sessionsResult && sessionsResult.pages > 1 ? (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              disabled={sessionsResult.page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-card border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              Newer
            </button>
            <button
              type="button"
              disabled={sessionsResult.page >= sessionsResult.pages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-card border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              Older
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function TimelineRow({ event, previousAt }: { event: AdminInsightEventDto; previousAt: string | null }) {
  const isAction = event.kind === "action";
  const Icon = isAction ? MousePointerClick : Eye;
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 text-xs">
      <span className="font-mono text-muted-foreground">
        {formatDateTime(event.occurredAt)}
      </span>
      {previousAt ? (
        <span className="text-muted-foreground/70">{gapLabel(Date.parse(previousAt), Date.parse(event.occurredAt))}</span>
      ) : (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          entry
        </span>
      )}
      <span className="flex items-center gap-1">
        <Icon aria-hidden className={`h-3.5 w-3.5 ${isAction ? "text-primary" : "text-muted-foreground"}`} />
        {isAction ? "action" : "view"}
      </span>
      <span className="min-w-0 truncate font-mono text-foreground">{event.path}</span>
      {event.name ? <span className="font-semibold text-primary">{event.name}</span> : null}
      {event.meta ? (
        <span className="truncate text-muted-foreground">
          {Object.entries(event.meta as Record<string, unknown>)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join(" ")}
        </span>
      ) : null}
    </li>
  );
}
