import type { SiteSettings } from "@travelghana/types";
import { Facebook, Instagram, Twitter, Youtube, type LucideIcon } from "lucide-react";

/**
 * Server-side data access for the public site settings (D24, perf-tuned D30).
 *
 * Contact + social info changes rarely, so this read is ISR-cached for a
 * short window: the footer and about page render from the prerendered cache
 * for speed, and admin edits appear at most ~60s later. When the API is
 * unreachable (e.g. not started yet) the page degrades gracefully: the
 * footer simply renders without the contact block.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function fetchSiteSettings(): Promise<SiteSettings | null> {
  try {
    const res = await fetch(`${API_URL}/site-settings`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { settings: SiteSettings };
    return data.settings;
  } catch {
    return null;
  }
}

/** Social platforms rendered in a fixed order, only when the URL is set. */
export function socialLinks(settings: SiteSettings): Array<{ href: string; label: string }> {
  const links: Array<{ href: string; label: string }> = [];
  if (settings.facebookUrl) links.push({ href: settings.facebookUrl, label: "Facebook" });
  if (settings.instagramUrl) links.push({ href: settings.instagramUrl, label: "Instagram" });
  if (settings.twitterUrl) links.push({ href: settings.twitterUrl, label: "X (Twitter)" });
  if (settings.youtubeUrl) links.push({ href: settings.youtubeUrl, label: "YouTube" });
  return links;
}

/** Fixed glyph per social label (labels/order come from socialLinks). The
 * caller sets the accessible name on the anchor; icons render aria-hidden. */
export const SOCIAL_ICONS: Record<string, LucideIcon> = {
  Facebook,
  Instagram,
  "X (Twitter)": Twitter,
  YouTube: Youtube,
};

/** True when at least one contact field (phone/WhatsApp/email/address) is set. */
export function hasContactInfo(settings: SiteSettings): boolean {
  return Boolean(
    settings.phone || settings.whatsapp || settings.email || settings.address,
  );
}

/** href for a phone call link: strip spaces so mobile dialers accept it. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[\s()-]/g, "")}`;
}

/** Chat link for the stored WhatsApp number (digits only, wa.me format).
 * An optional prefill text is URL-encoded into the deep link. */
export function waMeHref(whatsapp: string, text?: string): string {
  const base = `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
