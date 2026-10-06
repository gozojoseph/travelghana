"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, Map, Ticket, User } from "lucide-react";

const NAV = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/destinations", label: "Destinations", icon: Map },
  { href: "/operator", label: "For operators", icon: User },
];

/** Top header + mobile bottom nav (§35: Home / Explore / Trips / Favorites / Profile). */
export function SiteHeader() {
  const pathname = usePathname();

  const mobileNav = [
    { href: "/", label: "Home", icon: Compass },
    { href: "/explore", label: "Explore", icon: Map },
    { href: "/trips", label: "Trips", icon: Ticket },
    { href: "/favorites", label: "Favorites", icon: Heart },
    { href: "/account", label: "Profile", icon: User },
  ];

  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Link href="/" className="font-display text-xl text-primary">
            TravelGhana
          </Link>
          <nav aria-label="Main" className="ml-auto hidden items-center gap-6 md:flex">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={`text-sm font-medium underline-offset-4 hover:underline ${
                  pathname === href ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/account"
              className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              My TravelGhana
            </Link>
          </nav>
        </div>
      </header>

      {/* Mobile bottom navigation (§35) */}
      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {mobileNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon aria-hidden className="h-5 w-5" />
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
