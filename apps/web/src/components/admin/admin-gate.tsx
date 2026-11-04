"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  Building2,
  CalendarCheck,
  Car,
  Images,
  Inbox,
  LayoutDashboard,
  LineChart,
  Loader2,
  MapPinned,
  Package as PackageIcon,
  ScrollText,
  Library,
  Settings,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react";
import type { SessionUser } from "@travelghana/types";
import type { AdminStats } from "@travelghana/types";

import { Logo } from "@/components/brand/logo";

import { api } from "@/lib/api";
import { siteLink } from "@/lib/links";

/**
 * True when the browser is on the standalone admin-site host rather than the
 * main web app (D21). NEXT_PUBLIC_ADMIN_HOST is the public mirror of the
 * middleware's ADMIN_HOST and stays empty in local single-origin dev.
 */
function isAdminSite(): boolean {
  if (typeof window === "undefined") return false;
  const configured = (process.env.NEXT_PUBLIC_ADMIN_HOST ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  if (!configured) return false;
  return window.location.hostname.toLowerCase() === configured.split(":")[0]!.toLowerCase();
}

/** Grouped sections of the console (D20). Kept compact in the top bar. */
const ADMIN_NAV: Array<{ group: string; items: Array<{ href: string; label: string; icon: typeof LayoutDashboard }> }> = [
  {
    group: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/activity", label: "Activity", icon: ScrollText },
      { href: "/admin/insights", label: "Insights", icon: LineChart },
    ],
  },
  {
    group: "Reviews",
    items: [
      { href: "/admin/listings", label: "Listings", icon: MapPinned },
      { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
      { href: "/admin/transport", label: "Transport", icon: Car },
      { href: "/admin/reviews", label: "Package reviews", icon: Star },
      { href: "/admin/providers", label: "Providers", icon: Building2 },
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
    ],
  },
  {
    group: "Manage",
    items: [
      { href: "/admin/catalog", label: "Catalog", icon: Library },
      { href: "/admin/packages", label: "Packages", icon: PackageIcon },
      { href: "/admin/gallery", label: "Gallery", icon: Images },
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/users", label: "Users", icon: Users },
    ],
  },
];

/**
 * Client-side gate for the admin console. The API re-checks the ADMIN role on
 * every request; this keeps the admin UI out of the browser and bounces
 * signed-out users to login and signed-in non-admins to their account.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<"checking" | "ready" | "denied">("checking");
  const [user, setUser] = useState<SessionUser | null>(null);
  /** href -> pending count for the nav badges (D27); cosmetic, fails open. */
  const [badges, setBadges] = useState<Partial<Record<string, number>>>({});

  useEffect(() => {
    let active = true;

    api
      .me()
      .then(({ user: current }) => {
        if (!active) return;
        if (!current.roles.includes("ADMIN")) {
          // On the separate admin site there is no account page to bounce to -
          // the middleware funnels every non-admin path back to /admin - so
          // show an honest staff-only state with a sign-out instead (D21).
          if (isAdminSite()) {
            setUser(current);
            setState("denied");
          } else {
            window.location.replace("/account?notice=admin-only");
          }
          return;
        }
        setUser(current);
        setState("ready");
      })
      .catch(() => {
        if (!active) return;
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.replace(`/login?next=${encodeURIComponent(next)}`);
      });

    return () => {
      active = false;
    };
  }, []);

  // Per-section pending counts for the nav badges (D27). Once per console
  // visit; a failure just means no badges, never a broken console.
  useEffect(() => {
    if (state !== "ready") return;
    let active = true;
    api
      .adminStats()
      .then(({ stats }: { stats: AdminStats }) => {
        if (!active) return;
        setBadges({
          "/admin/listings": stats.counts.listingsPendingReview,
          "/admin/bookings": stats.counts.packageBookingsPending,
          "/admin/transport": stats.counts.listingRequestsPending,
          "/admin/reviews": stats.counts.reviewsPending,
          "/admin/enquiries": stats.counts.enquiriesNew,
          "/admin/providers": stats.counts.providersUnverified,
          "/admin/packages": stats.counts.packagesDraft,
          "/admin/catalog":
            stats.counts.destinationsUnpublished + stats.counts.attractionsUnpublished,
          "/admin/notifications": stats.counts.notificationsQueued,
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [state]);

  /** On the admin site a non-admin can only leave via an explicit sign-out. */
  async function signOut(): Promise<void> {
    await api.logout().catch(() => undefined);
    window.location.href = "/login";
  }

  if (state === "checking") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
        <Logo className="h-12 w-auto" alt="" />
        <Loader2 aria-hidden className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm" role="status">
          Checking admin access…
        </p>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
        <Logo className="h-12 w-auto" alt="" />
        <ShieldAlert aria-hidden className="h-6 w-6 text-accent" />
        <p className="font-display text-2xl text-foreground">Staff accounts only</p>
        <p className="max-w-sm text-sm">
          You are signed in as {user?.email}. This console is limited to TravelGhana staff
          accounts — sign out to switch accounts.
        </p>
        <button
          type="button"
          onClick={signOut}
          className="rounded-card bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]"
        >
          Sign out
        </button>
      </main>
    );
  }

  return (
    <>
      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-sm font-semibold transition-colors hover:text-primary"
          >
            <Logo className="h-7 w-auto" alt="" />
            Admin console
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{user?.email}</span>
            <Link
              href={siteLink("/")}
              className="transition-colors hover:text-foreground"
            >
              Back to site
            </Link>
          </div>
        </div>
      </div>
      <nav aria-label="Admin sections" className="border-b border-border bg-card">
        {/* One horizontally scrollable strip on phones (group labels hidden,
            links never squeeze); the normal wrapping bar from sm upward. */}
        <div className="mx-auto flex max-w-6xl flex-nowrap items-center gap-3 overflow-x-auto px-6 py-2 sm:flex-wrap sm:gap-x-4 sm:gap-y-1 sm:overflow-visible max-sm:mx-0 max-sm:max-w-none">
          {ADMIN_NAV.map(({ group, items }) => (
            <div key={group} className="flex shrink-0 items-center gap-1">
              <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 sm:inline">
                {group}
              </span>
              {items.map(({ href, label, icon: Icon }) => {
                const active = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex shrink-0 items-center gap-1.5 rounded-card px-2 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon aria-hidden className="h-4 w-4" />
                    {label}
                    {typeof badges[href] === "number" && badges[href]! > 0 ? (
                      <span
                        aria-hidden
                        className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground"
                      >
                        {badges[href]! > 99 ? "99+" : badges[href]}
                      </span>
                    ) : null}
                    {typeof badges[href] === "number" && badges[href]! > 0 ? (
                      <span className="sr-only">, {badges[href]} pending</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </nav>
      {children}
    </>
  );
}
