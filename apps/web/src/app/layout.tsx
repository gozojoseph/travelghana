import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Plus_Jakarta_Sans } from "next/font/google";

import { SiteHeader } from "@/components/layout/site-header";

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

export const metadata: Metadata = {
  title: {
    default: "TravelGhana — Everything you need to experience Ghana",
    template: "%s · TravelGhana",
  },
  description:
    "Discover Ghana, plan your journey, book tours, experiences, hotels and trusted drivers — all in one place.",
};

export const viewport: Viewport = {
  themeColor: "#006B3F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh font-sans">
        <SiteHeader />
        {children}
        {/* bottom nav clearance on mobile */}
        <div aria-hidden className="h-16 md:hidden" />
      </body>
    </html>
  );
}
