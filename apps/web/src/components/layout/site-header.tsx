"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, Compass, Images, Info, Map, Menu, Package, Search, Ticket, User, X } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { siteLink } from "@/lib/links";
import { api } from "@/lib/api";

const NAV = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/destinations", label: "Destinations", icon: Map },
  { href: "/packages", label: "Packages", icon: Package },
  { href: "/gallery", label: "Gallery", icon: Images },
  { href: "/plan-my-trip", label: "Plan a trip", icon: Ticket },
  { href: "/about", label: "About", icon: Info },
];

/** Top header + mobile bottom nav (§35 nav structure, trimmed in D22 - no favorites/operator entries). */
export function SiteHeader() {
  const pathname = usePathname();
  /**
   * "Info for you" bubble (D27): the signed-in member's package booking
   * count. Trips live one click away on the account cards; the header badge
   * stays to the one thing that is usually waiting on a human, and it stays
   * hidden for anonymous visitors (the /users/counts call 401s) and when
   * there is nothing to show.
   */
  const [bookingsBadge, setBookingsBadge] = useState<number | null>(null);
  /**
   * Unread inbox count (D40): rows the platform already wrote for this
   * member when a booking moved or the team reached out. Same discipline as
   * the bookings bubble - hidden for anonymous visitors (401) and at zero.
   */
  const [notifBadge, setNotifBadge] = useState<number | null>(null);
  /**
   * Disclosure menu (below lg): one tap lists every site destination plus
   * search, notifications and the account action; the inline row keeps
   * covering desktop. Panel links and Escape close it directly (below).
   */
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then(({ user }) => {
        if (!active || !user) return;
        api
          .userCounts()
          .then(({ counts }) => {
            if (active) setBookingsBadge(counts.packageBookings);
          })
          .catch(() => undefined);
        api
          .notificationsUnread()
          .then(({ unread }) => {
            if (active) setNotifBadge(unread);
          })
          .catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  /**
   * Outside the header a tap closes the disclosure; Escape closes it no
   * matter where focus sits (even on a menu link). Both subscribe at the
   * document level - the React-recommended way to sync with external
   * systems - instead of decorating non-interactive elements.
   */
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const mobileNav = [
    { href: "/", label: "Home", icon: Compass },
    { href: "/explore", label: "Explore", icon: Map },
    { href: "/search", label: "Search", icon: Search },
    { href: "/plan-my-trip", label: "Plan", icon: Ticket },
    { href: "/account", label: "Profile", icon: User },
  ];

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Link href={siteLink("/")} className="inline-flex items-center gap-2">
            <Logo className="h-9 w-auto sm:h-10" alt="" />
            <span className="font-display text-xl text-primary">TravelGhana</span>
          </Link>
          <nav aria-label="Main" className="ml-auto hidden items-center gap-5 lg:flex">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={siteLink(href)}
                aria-current={pathname === href ? "page" : undefined}
                className={`text-sm font-medium underline decoration-2 underline-offset-4 transition-[color,text-decoration-color] duration-200 ${
                  pathname === href
                    ? "text-primary decoration-primary font-semibold"
                    : "text-foreground/75 decoration-transparent hover:text-foreground hover:decoration-primary"
                }`}
              >
                {label}
              </Link>
            ))}
            {/* Site search (D40): a native GET form - no JS needed to land on
                /search?q=... works for keyboards, screen readers and the
                tunnel preview alike. */}
            <form action="/search" role="search" className="hidden items-center lg:flex">
              <input
                type="search"
                name="q"
                placeholder="Search Ghana…"
                aria-label="Search TravelGhana"
                className="h-9 w-40 rounded-card border border-border bg-background px-3 text-sm outline-none transition-[border-color] duration-150 placeholder:text-muted-foreground focus:border-primary xl:w-56"
              />
            </form>
            <Link
              href={siteLink("/account/notifications")}
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-card text-foreground/75 transition-colors hover:text-foreground"
            >
              <Bell aria-hidden className="h-5 w-5" />
              {notifBadge !== null && notifBadge > 0 ? (
                <>
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[9px] font-bold leading-none text-primary-foreground"
                  >
                    {notifBadge > 9 ? "9+" : notifBadge}
                  </span>
                  <span className="sr-only">, {notifBadge} unread</span>
                </>
              ) : null}
            </Link>
            <Link
              href={siteLink("/account")}
              aria-label="My TravelGhana"
              className="relative flex h-9 w-9 items-center justify-center rounded-card text-foreground/75 transition-colors hover:text-foreground"
            >
              <User aria-hidden className="h-5 w-5" />
              {bookingsBadge !== null && bookingsBadge > 0 ? (
                <>
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[9px] font-bold leading-none text-primary-foreground"
                  >
                    {bookingsBadge > 99 ? "99+" : bookingsBadge}
                  </span>
                  <span className="sr-only">, {bookingsBadge} booking requests to review</span>
                </>
              ) : null}
            </Link>
          </nav>

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((value) => !value)}
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-card text-foreground/75 transition-colors hover:text-foreground lg:hidden"
          >
            {menuOpen ? <X aria-hidden className="h-6 w-6" /> : <Menu aria-hidden className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen ? (
          <div
            id="site-menu"
            className="absolute inset-x-0 top-full z-40 mx-auto max-w-6xl px-3 pb-3 lg:hidden"
          >
            <div className="animate-pop overflow-hidden rounded-card border border-border bg-card shadow-md">
              <ul className="divide-y divide-border">
                {NAV.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <li key={href}>
                      <Link
                        href={siteLink(href)}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                          active
                            ? "bg-muted font-semibold text-primary"
                            : "text-foreground/75 hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon aria-hidden className="h-4 w-4" />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="space-y-2 border-t border-border p-3">
                <Link
                  href={siteLink("/search")}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-card border border-border bg-background px-3 py-2.5 text-sm text-foreground/75 transition-colors hover:text-foreground"
                >
                  <Search aria-hidden className="h-4 w-4" />
                  Search Ghana
                </Link>
                <Link
                  href={siteLink("/account/notifications")}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between rounded-card px-3 py-2.5 text-sm text-foreground/75 transition-colors hover:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Bell aria-hidden className="h-4 w-4" />
                    Notifications
                  </span>
                  {notifBadge !== null && notifBadge > 0 ? (
                    <span
                      aria-hidden
                      className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[9px] font-bold leading-none text-primary-foreground"
                    >
                      {notifBadge > 9 ? "9+" : notifBadge}
                    </span>
                  ) : null}
                </Link>
                <Link
                  href={siteLink("/account")}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between rounded-card px-3 py-2.5 text-sm text-foreground/75 transition-colors hover:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <User aria-hidden className="h-4 w-4" />
                    My TravelGhana
                  </span>
                  {bookingsBadge !== null && bookingsBadge > 0 ? (
                    <span
                      aria-hidden
                      className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[9px] font-bold leading-none text-primary-foreground"
                    >
                      {bookingsBadge > 9 ? "9+" : bookingsBadge}
                    </span>
                  ) : null}
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {/* Mobile bottom navigation (§35) */}
      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {mobileNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href} className="flex-1">
                <Link
                  href={siteLink(href)}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-[color,transform] duration-150 active:scale-95 ${
                    active ? "text-primary" : "text-foreground/70"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary transition-opacity duration-200 ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <Icon aria-hidden className="h-5 w-5" />
                  {href === "/account" && bookingsBadge !== null && bookingsBadge > 0 ? (
                    <>
                      <span
                        aria-hidden
                        className="absolute left-1/2 top-1 ml-2 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[9px] font-bold leading-none text-primary-foreground"
                      >
                        {bookingsBadge > 9 ? "9+" : bookingsBadge}
                      </span>
                      <span className="sr-only">, {bookingsBadge} booking requests to review</span>
                    </>
                  ) : null}
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
