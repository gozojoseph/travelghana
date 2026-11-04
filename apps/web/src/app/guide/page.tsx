import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Site guide",
  description:
    "A plain-text overview of everything on TravelGhana — destinations, created packages, trip planning, the gallery and more.",
  alternates: { canonical: "/guide" },
};

/**
 * Site guide (D29): a search-engine-style overview of the whole site, one
 * text-first "result" block plus a two-column grid of quick links into real,
 * shipped pages. Modelled on how a search listing reads (favicon + site name
 * + URL, big title link, snippet, then bold section links with descriptions)
 * - translated into the TravelGhana brand, with no cards or ornaments.
 *
 * The URL line shows the actual request host (never an invented domain): in
 * dev that is localhost, at launch it becomes the deployed domain on its own.
 */
const SECTIONS = [
  {
    href: "/destinations",
    title: "Destinations",
    body: "Castles, rainforests, waterfalls and savannas across Ghana's regions.",
  },
  {
    href: "/packages",
    title: "Packages",
    body: "Multi-day journeys planned end to end — forts and coastline, culture, nature.",
  },
  {
    href: "/explore",
    title: "Explore Ghana",
    body: "Browse the catalog by category and find your next stop.",
  },
  {
    href: "/plan-my-trip",
    title: "Plan a trip",
    body: "Answer a few questions and get a trip outline you can refine.",
  },
  {
    href: "/gallery",
    title: "Gallery",
    body: "People, places and colour from across Ghana.",
  },
  {
    href: "/about",
    title: "About us",
    body: "Who we are and how we work.",
  },
  {
    href: "/enquire",
    title: "Enquire",
    body: "Ask the concierge team for help planning a journey.",
  },
  {
    href: "/account",
    title: "My TravelGhana",
    body: "Your trips, your booking requests, your account.",
  },
];

export default async function SiteGuidePage() {
  const host = (await headers()).get("host") ?? "";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      {/* Result block: site identity row, URL line, big title link, snippet */}
      <div className="flex items-center gap-2">
        <Logo className="h-5 w-auto" alt="" />
        <span className="text-sm font-medium">TravelGhana</span>
      </div>
      {host ? <p className="mt-0.5 text-xs text-muted-foreground">{host}</p> : null}

      <h1 className="mt-3 max-w-3xl">
        <Link
          href="/"
          className="text-2xl font-semibold text-primary underline-offset-4 transition-colors hover:underline sm:text-3xl"
        >
          Everything you need to experience Ghana — TravelGhana
        </Link>
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Destinations, created packages, trip planning and a gallery of Ghana — built
        by people who know the road.{" "}
        <Link
          href="/about"
          className="text-primary underline-offset-2 transition-colors hover:underline"
        >
          Read more
        </Link>
      </p>

      {/* Two-column quick links (row-flow, uneven heights allowed like a search
          listing); every target is a real shipped page. */}
      <div className="tg-stagger mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
        {SECTIONS.map(({ href, title, body }) => (
          <section key={href}>
            <h2 className="text-lg font-semibold">
              <Link
                href={href}
                className="text-primary underline-offset-4 transition-colors hover:underline"
              >
                {title}
              </Link>
            </h2>
            <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
