import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { GhanaFlag } from "@/components/brand/ghana-flag";
import { Logo } from "@/components/brand/logo";
import { siteLink } from "@/lib/links";
import {
  fetchSiteSettings,
  hasContactInfo,
  SOCIAL_ICONS,
  socialLinks,
  telHref,
  waMeHref,
} from "@/lib/site-settings";

const FOOTER_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/destinations", label: "Destinations" },
  { href: "/packages", label: "Packages" },
  { href: "/gallery", label: "Gallery" },
  { href: "/plan-my-trip", label: "Plan a trip" },
  { href: "/about", label: "About" },
  { href: "/guide", label: "Site guide" },
];

/** Site-wide footer: dark brand block, contact info (D24, admin-editable),
 * short links, copyright (§35). Contact + social rows only render when the
 * admin has filled them in. */
export async function SiteFooter() {
  const settings = await fetchSiteSettings();
  const socials = settings ? socialLinks(settings) : [];

  return (
    <footer className="border-t border-footer-border bg-footer text-footer-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href={siteLink("/")} className="inline-flex items-center gap-2">
              <Logo className="h-9 w-auto" alt="" />
              <span className="font-display text-lg">TravelGhana</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-footer-muted">
              Everything you need to experience Ghana — destinations, packages and trusted local
              operators.
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs text-footer-muted">
              <GhanaFlag className="h-3 w-auto rounded-[1px]" />
              Made in Ghana
            </p>
            {settings && hasContactInfo(settings) && (
              <address className="mt-6 grid gap-1.5 text-sm not-italic">
                {settings.phone && (
                  <a
                    href={telHref(settings.phone)}
                    className="flex items-center gap-2 text-footer-muted transition-colors hover:text-footer-foreground"
                  >
                    <Phone aria-hidden className="h-4 w-4 shrink-0" />
                    {settings.phone}
                  </a>
                )}
                {settings.whatsapp && (
                  <a
                    href={waMeHref(settings.whatsapp)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-2 text-footer-muted transition-colors hover:text-footer-foreground"
                  >
                    <MessageCircle aria-hidden className="h-4 w-4 shrink-0" />
                    WhatsApp {settings.whatsapp}
                  </a>
                )}
                {settings.email && (
                  <a
                    href={`mailto:${settings.email}`}
                    className="flex items-center gap-2 text-footer-muted transition-colors hover:text-footer-foreground"
                  >
                    <Mail aria-hidden className="h-4 w-4 shrink-0" />
                    {settings.email}
                  </a>
                )}
                {settings.address && (
                  <span className="flex items-center gap-2 text-footer-muted">
                    <MapPin aria-hidden className="h-4 w-4 shrink-0" />
                    {settings.address}
                  </span>
                )}
              </address>
            )}
            {socials.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {socials.map(({ href, label }) => {
                  const Icon = SOCIAL_ICONS[label];
                  if (!Icon) return null;
                  return (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={label}
                      title={label}
                      className="grid h-9 w-9 place-items-center rounded-full border border-footer-border text-footer-muted transition-colors hover:border-footer-foreground/30 hover:text-footer-foreground"
                    >
                      <Icon aria-hidden className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            )}
            {/* Licence & membership badges (owner-confirmed GTA licence and GPRTU
                membership). Placed on light chips so the emblems keep their normal
                contrast on the dark footer. */}
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/gta-logo.webp"
                  alt="Ghana Tourism Authority"
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-auto rounded-[6px] bg-white p-2"
                />
                <p className="text-xs leading-snug text-footer-muted">
                  Licensed by the
                  <br />
                  Ghana Tourism Authority
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/gprtu-logo.jpg"
                  alt="Ghana Private Road Transport Union of TUC seal"
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 rounded-[6px] bg-white p-2"
                />
                <p className="text-xs leading-snug text-footer-muted">
                  Drivers&rsquo; union member
                  <br />
                  GPRTU of TUC
                </p>
              </div>
            </div>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            {FOOTER_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={siteLink(href)}
                className="text-sm text-footer-muted transition-colors hover:text-footer-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 border-t border-footer-border pt-4 text-xs text-footer-muted">
          © {new Date().getFullYear()} TravelGhana. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
