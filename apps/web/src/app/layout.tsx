import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Plus_Jakarta_Sans } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { BehaviorTracker } from "@/components/behavior-tracker";
import { WhatsAppFab } from "@/components/whatsapp/whatsapp-fab";
import { JsonLd } from "@/components/seo/json-ld";
import { fetchSiteSettings, socialLinks } from "@/lib/site-settings";

import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

/**
 * Canonical origin for metadata and structured data (D40). Deployments and
 * the preview tunnel set NEXT_PUBLIC_SITE_URL; localhost is the dev fallback
 * so relative canonicals still resolve during local work.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Travel Ghana",
  title: {
    default: "TravelGhana — Everything you need to experience Ghana",
    template: "%s · TravelGhana",
  },
  description:
    "Discover Ghana, plan your journey, book tours, experiences, hotels and trusted drivers — all in one place.",
  appleWebApp: {
    capable: true,
    title: "Travel Ghana",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#006B3F",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The same 60s-cached read the footer uses; cached, so this stays cheap.
  const settings = await fetchSiteSettings();

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TravelGhana",
    url: siteUrl,
    ...(settings?.facebookUrl ||
    settings?.instagramUrl ||
    settings?.twitterUrl ||
    settings?.youtubeUrl
      ? {
          sameAs: socialLinks(settings).map((link) => link.href),
        }
      : {}),
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TravelGhana",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh font-sans">
        <JsonLd data={organization} />
        <JsonLd data={website} />
        <SiteHeader />
        {children}
        <SiteFooter />
        <WhatsAppFab />
        <BehaviorTracker />
        {/* bottom nav clearance on mobile */}
        <div aria-hidden className="h-16 lg:hidden" />
      </body>
    </html>
  );
}
