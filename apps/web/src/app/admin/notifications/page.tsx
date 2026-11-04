"use client";

import { useEffect, useState } from "react";
import { Info, Trash2 } from "lucide-react";
import type {
  AdminNotificationDto,
  NotificationStatusValue,
} from "@travelghana/types";

import { api, ApiClientError } from "@/lib/api";
import {
  formatDateTime,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_STATUS_CHIP_CLASS,
  NOTIFICATION_STATUS_LABELS,
} from "@/components/admin/shared";

const STATUS_FILTERS: Array<NotificationStatusValue | "ALL"> = ["ALL", "QUEUED", "SENT", "FAILED"];

/**
 * Notification outbox (§Admin): every notification the platform queues —
 * operator decision notices, enquiry confirmations. There is deliberately no
 * resend control: no delivery provider is wired yet, so retrying would be a
 * fake button (OPEN_QUESTIONS #9). D28 adds a cleanup delete for stale
 * queued/failed records; sent records stay as delivery history.
 */
export default function AdminNotificationsPage() {
  const [items, setItems] = useState<AdminNotificationDto[] | null>(null);
  const [status, setStatus] = useState<NotificationStatusValue | "ALL">("ALL");
  const [type, setType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      api
        .adminNotifications({ status: status === "ALL" ? undefined : status, type: type.trim() || undefined })
        .then((result) => {
          if (!active) return;
          setItems(result.items);
          setError(null);
        })
        .catch((err) => {
          if (!active) return;
          setError(
            err instanceof ApiClientError && err.status === 403
              ? "Admin access is required."
              : err instanceof Error
                ? err.message
                : "Could not load the outbox.",
          );
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [status, type]);

  /** Outbox cleanup (D28): queued/failed records only - server refuses SENT. */
  const deleteRow = async (row: AdminNotificationDto) => {
    if (!window.confirm(`Delete this ${NOTIFICATION_STATUS_LABELS[row.status].toLowerCase()} notification? It will be removed permanently.`)) {
      return;
    }
    setDeletingId(row.id);
    setError(null);
    try {
      await api.deleteNotification(row.id);
      setItems((prev) => (prev ?? []).filter((item) => item.id !== row.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete the notification.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 pb-24">
      <header>
        <h1 className="font-display text-3xl">Notifications</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The delivery outbox: records of every message the platform queues for an account.
        </p>
      </header>

      <aside role="note" className="mt-4 flex items-start gap-2 rounded-card border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
        <p>
          <strong className="text-foreground">Queue-only today.</strong> Entries are stored and
          visible, but no delivery provider (email/SMS) is wired yet, so there is no resend
          action — that would be a fake button. Delivery arrives in a later increment
          (OPEN_QUESTIONS #9). Stale queued or failed records can be deleted from a row&apos;s
          expanded view; sent records stay as delivery history.
        </p>
      </aside>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              aria-pressed={status === value}
              className={
                status === value
                  ? "rounded-card bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                  : "rounded-card border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {value === "ALL" ? "All" : NOTIFICATION_STATUS_LABELS[value]}
            </button>
          ))}
        </div>
        <div>
          <label className="sr-only" htmlFor="type">
            Filter by type
          </label>
          <input
            id="type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            placeholder="Type contains… e.g. listing"
            className="w-64 rounded-card border border-border bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
            maxLength={120}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {items === null && !error ? (
        <p className="mt-10 text-sm text-muted-foreground" role="status">
          Loading the outbox…
        </p>
      ) : null}

      {items !== null && items.length === 0 ? (
        <div className="mt-10 rounded-card border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="font-medium">Nothing queued</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Notifications appear here as platform events happen (reviews, enquiries, verifications).
          </p>
        </div>
      ) : null}

      <ul className="mt-6 space-y-2">
        {(items ?? []).map((row) => {
          const expanded = openId === row.id;
          const payload = row.payload && typeof row.payload === "object" ? row.payload : null;
          return (
            <li key={row.id} className="rounded-card border border-border bg-card px-4 py-3">
              <button
                type="button"
                onClick={() => setOpenId(expanded ? null : row.id)}
                aria-expanded={expanded}
                className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{row.type.toLowerCase().replaceAll("_", " ")}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {NOTIFICATION_CHANNEL_LABELS[row.channel] ?? row.channel} ·{" "}
                    {row.userEmail ?? row.userId.slice(0, 10)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${NOTIFICATION_STATUS_CHIP_CLASS[row.status] ?? "bg-muted"}`}>
                    {NOTIFICATION_STATUS_LABELS[row.status] ?? row.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span>
                </span>
              </button>
              {expanded ? (
                <div className="mt-3 rounded-card bg-muted/40 p-3 text-sm">
                  {payload ? (
                    <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                      {Object.entries(payload).map(([key, value]) => (
                        <div key={key} className="min-w-0">
                          <dt className="text-xs text-muted-foreground">{key}</dt>
                          <dd className="truncate text-sm">
                            {value === null || value === undefined
                              ? "—"
                              : typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-muted-foreground">No payload recorded.</p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Sent: {row.sentAt ? formatDateTime(row.sentAt) : "not yet (queued)"} · Read:{" "}
                    {row.readAt ? formatDateTime(row.readAt) : "—"}
                  </p>
                  {row.status === "SENT" ? null : (
                    <div className="mt-3 border-t border-border pt-3">
                      <button
                        type="button"
                        onClick={() => deleteRow(row)}
                        disabled={deletingId !== null}
                        className="inline-flex items-center gap-1.5 rounded-card border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 aria-hidden className="h-3.5 w-3.5" />
                        {deletingId === row.id ? "Deleting…" : "Delete"}
                      </button>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Removes this {NOTIFICATION_STATUS_LABELS[row.status].toLowerCase()} record permanently. Sent records are delivery history and cannot be deleted.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
