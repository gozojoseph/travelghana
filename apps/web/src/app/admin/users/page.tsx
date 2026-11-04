"use client";

import { useEffect, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import type { AdminUserDto } from "@travelghana/types";

import { api, ApiClientError } from "@/lib/api";
import {
  formatDateTime,
  MEMBERSHIP_STATUS_LABELS,
  ROLE_LABELS,
  USER_STATUS_CHIP_CLASS,
  USER_STATUS_LABELS,
  USER_STATUS_VALUES,
  secondaryButtonClass,
} from "@/components/admin/shared";

/**
 * Users & roles (D20): grant/revoke role memberships and suspend or reactivate
 * accounts. The API enforces the guardrails (no self-suspend, no self-demotion,
 * never removing the last active ADMIN) — the surfaced error copy explains why.
 */
export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUserDto[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED" | "">("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      api
        .adminUsers({ q: q.trim() || undefined, status: status || undefined })
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
                : "Could not load users.",
          );
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q, status]);

  async function patch(
    id: string,
    input: { addRoles?: string[]; removeRoles?: string[]; status?: "ACTIVE" | "SUSPENDED" },
  ) {
    setBusyId(id);
    setError(null);
    setFeedback(null);
    try {
      const { user, message } = await api.updateAdminUser(id, input);
      setItems((rows) => (rows ?? []).map((row) => (row.id === id ? user : row)));
      setFeedback(`${user.email}: ${message}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the user");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 pb-24">
      <header>
        <h1 className="font-display text-3xl">Users & roles</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Role memberships drive what accounts can do. Suspending an account ends its sessions
          immediately; you cannot suspend yourself, and the console refuses to remove the last
          remaining admin.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3" role="search" aria-label="Filter users">
        <div className="relative">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label className="sr-only" htmlFor="q">
            Search users
          </label>
          <input
            id="q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search name or email…"
            className="w-72 rounded-card border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            maxLength={120}
          />
        </div>
        <div className="flex gap-1" role="group" aria-label="Filter by status">
          <button
            type="button"
            onClick={() => setStatus("")}
            aria-pressed={status === ""}
            className={
              status === ""
                ? "rounded-card bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                : "rounded-card border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            }
          >
            All
          </button>
          {USER_STATUS_VALUES.map((value) => (
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
              {USER_STATUS_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {feedback ? (
        <p className="mt-4 text-sm text-primary" role="status">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {items === null && !error ? (
        <p className="mt-10 text-sm text-muted-foreground" role="status">
          Loading users…
        </p>
      ) : null}

      {items !== null && items.length === 0 ? (
        <div className="mt-10 rounded-card border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="font-medium">No users match</p>
          <p className="mt-1 text-sm text-muted-foreground">Try another search.</p>
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {(items ?? []).map((user) => {
          const open = openId === user.id;
          const activeRoles = user.roles;
          const grantable = (Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).filter(
            (role) => !activeRoles.includes(role),
          );
          return (
            <li key={user.id} className="rounded-card border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {user.name ?? user.email}
                    {user.emailVerified ? null : (
                      <span className="ml-2 rounded-card bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Email unverified
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {user.email} · joined {formatDateTime(user.createdAt)}
                    {user.providerId ? " · operator account" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${USER_STATUS_CHIP_CLASS[user.status]}`}>
                    {USER_STATUS_LABELS[user.status]}
                  </span>
                  {activeRoles.map((role) => (
                    <span key={role} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {ROLE_LABELS[role]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : user.id)}
                  aria-expanded={open}
                  className={secondaryButtonClass}
                >
                  {open ? "Close roles" : "Manage roles"}
                </button>
                {user.status === "ACTIVE" ? (
                  <button
                    type="button"
                    onClick={() => void patch(user.id, { status: "SUSPENDED" })}
                    disabled={busyId === user.id}
                    className="rounded-card border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void patch(user.id, { status: "ACTIVE" })}
                    disabled={busyId === user.id}
                    className="rounded-card border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-50 disabled:opacity-50"
                  >
                    Reactivate
                  </button>
                )}
              </div>

              {open ? (
                <div className="mt-4 rounded-card border border-border bg-muted/30 p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Memberships
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {user.memberships.map((membership) => (
                      <li key={membership.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {ROLE_LABELS[membership.role]}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({MEMBERSHIP_STATUS_LABELS[membership.status]})
                          </span>
                        </span>
                        {membership.status === "ACTIVE" ? (
                          <button
                            type="button"
                            onClick={() => void patch(user.id, { removeRoles: [membership.role] })}
                            disabled={busyId === user.id}
                            className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {grantable.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {grantable.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => void patch(user.id, { addRoles: [role] })}
                          disabled={busyId === user.id}
                          className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                          + {ROLE_LABELS[role]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
                      Every role is already granted.
                    </p>
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
