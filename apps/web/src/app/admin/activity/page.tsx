"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { AdminAuditDto } from "@travelghana/types";

import { api, ApiClientError } from "@/lib/api";
import { formatDateTime } from "@/components/admin/shared";

/**
 * Activity trail (§Admin): the read-only audit log of every recorded console
 * action. meta JSON is expanded per row — it is the "why" behind the row.
 */
export default function AdminActivityPage() {
  const [items, setItems] = useState<AdminAuditDto[] | null>(null);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      api
        .adminAudit({ action: action.trim() || undefined, entityType: entityType.trim() || undefined })
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
                : "Could not load the audit trail.",
          );
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [action, entityType]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 pb-24">
      <header>
        <h1 className="font-display text-3xl">Activity</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every recorded admin action across the console, newest first. This trail is read-only —
          entries are written by the API as mutations happen.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3" role="search" aria-label="Filter activity">
        <div className="relative">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label className="sr-only" htmlFor="action">
            Filter by action
          </label>
          <input
            id="action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="Action contains… e.g. listing"
            className="w-64 rounded-card border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            maxLength={120}
          />
        </div>
        <div>
          <label className="sr-only" htmlFor="entityType">
            Filter by entity type
          </label>
          <input
            id="entityType"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            placeholder="Entity type… e.g. Enquiry"
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
          Loading activity…
        </p>
      ) : null}

      {items !== null && items.length === 0 ? (
        <div className="mt-10 rounded-card border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="font-medium">Nothing recorded</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No entries match these filters.
          </p>
        </div>
      ) : null}

      <ul className="mt-6 space-y-2">
        {(items ?? []).map((row) => {
          const expanded = openId === row.id;
          const meta = row.meta && typeof row.meta === "object" ? row.meta : null;
          return (
            <li key={row.id} className="rounded-card border border-border bg-card px-4 py-3">
              <button
                type="button"
                onClick={() => setOpenId(expanded ? null : row.id)}
                aria-expanded={expanded}
                className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{row.action.toLowerCase().replaceAll("_", " ")}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    on {row.entityType}
                    {row.entityId ? ` · ${row.entityId.slice(0, 10)}…` : ""}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.actorEmail ?? "system"} · {formatDateTime(row.createdAt)}
                </span>
              </button>
              {expanded ? (
                <div className="mt-3 rounded-card bg-muted/40 p-3 text-sm">
                  {meta ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Detail
                      </p>
                      <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                        {Object.entries(meta).map(([key, value]) => (
                          <div key={key} className="min-w-0">
                            <dt className="text-xs text-muted-foreground">{key}</dt>
                            <dd className="truncate text-sm">
                              {value === null
                                ? "—"
                                : typeof value === "object"
                                  ? JSON.stringify(value)
                                  : String(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No detail recorded on this entry.</p>
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
