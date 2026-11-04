import type { Metadata } from "next";
import Link from "next/link";
import {
  Compass,
  HeartHandshake,
  Images,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { GhanaFlag } from "@/components/brand/ghana-flag";
import {
  fetchSiteSettings,
  hasContactInfo,
  SOCIAL_ICONS,
  socialLinks,
  telHref,
  waMeHref,
} from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "About",
  description:
    "TravelGhana is built in Ghana — created journeys, local knowledge and one calm place to plan the whole trip.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  {
    icon: MapPin,
    title: "Rooted in Ghana",
    body: "We plan from here, not from a desk somewhere else. Routes, timing and the small stops come from people who know the road.",
  },
  {
    icon: HeartHandshake,
    title: "People first",
    body: "Travel should be good for the people who host it. We look for local guides, family-run stays and fair, transparent prices.",
  },
  {
    icon: ShieldCheck,
    title: "Clear and honest",
    body: "No pressure and no hidden extras. Prices are shown in cedis and every journey tells you what is included before you decide.",
  },
];

const STEPS = [
  {
    title: "We travel it first",
    body: "Every journey we create starts on the ground: drive times, the light, the food and the places worth slowing down for.",
  },
  {
    title: "We write the day by day",
    body: "A package is a real plan, not a list of logos — a clear outline, honest inclusions and room to make it yours.",
  },
  {
    title: "We keep it current",
    body: "Guides and journeys are reviewed as places change, so what you read here is what you'll find when you arrive.",
  },
];

const OFFERS = [
  {
    href: "/explore",
    icon: Compass,
    title: "Explore destinations",
    body: "From the castles of the Central Region to the savannas of the north.",
  },
  {
    href: "/packages",
    icon: Sparkles,
    title: "Take a created journey",
    body: "Multi-day Ghana trips planned end to end, with the outline written out.",
  },
  {
    href: "/trips",
    icon: Route,
    title: "Plan your own trip",
    body: "Build a day-by-day itinerary and keep every detail in one place.",
  },
  {
    href: "/gallery",
    icon: Images,
    title: "See Ghana in pictures",
    body: "People, places, colour and coastline — the country through our lens.",
  },
];

export default async function AboutPage() {
  const settings = await fetchSiteSettings();
  const socials = settings ? socialLinks(settings) : [];
  const showContact = settings ? hasContactInfo(settings) || socials.length > 0 : false;

  return (
    <main>
      {/* Intro band — deep green so the story leads, not a stock photo. */}
      <section className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <p className="animate-rise flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-secondary">
            <GhanaFlag className="h-4 w-auto rounded-[2px]" />
            About TravelGhana
          </p>
          <h1 className="animate-rise mt-2 max-w-3xl font-display text-4xl leading-tight [animation-delay:40ms] md:text-5xl">
            Built in Ghana, for the way you want to travel.
          </h1>
          <p className="animate-rise mt-4 max-w-2xl text-lg text-primary-foreground/85 [animation-delay:80ms]">
            TravelGhana brings destinations, created journeys and practical planning into one calm
            place — so you can spend less time comparing tabs and more time experiencing the
            country.
          </p>
          <div className="animate-rise mt-8 flex flex-wrap gap-3 [animation-delay:120ms]">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-card bg-secondary px-6 py-3 font-semibold text-[color:var(--tg-text-primary)] transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.98]"
            >
              <Compass aria-hidden className="h-5 w-5" />
              Explore Ghana
            </Link>
            <Link
              href="/packages"
              className="inline-flex items-center gap-2 rounded-card border border-white/40 bg-white/5 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-[background-color,transform] duration-150 hover:bg-white/15 active:scale-[0.98]"
            >
              <Sparkles aria-hidden className="h-5 w-5" />
              See created packages
            </Link>
          </div>
        </div>
      </section>

      {/* Mission + values */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl">Why we exist</h2>
          <p className="mt-3 text-muted-foreground">
            Ghana is one of the most welcoming places on earth, but planning a trip here can still
            feel scattered — a guidebook for the coast, a blog for the north, a message thread for
            a driver. We are building the opposite: one place with real journeys, real prices and
            real local knowledge.
          </p>
        </div>

        <div className="tg-stagger mt-8 grid gap-4 md:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-card border border-border bg-card p-6">
              <Icon aria-hidden className="h-7 w-7 text-primary" />
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How we curate */}
      <section className="border-y border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-3xl">How we curate</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Whether it is a package or a destination guide, the process is the same: go, learn,
            write it down plainly.
          </p>

          <ol className="tg-stagger mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-card border border-border bg-card p-6">
                <p className="font-display text-2xl text-secondary">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-3 font-semibold">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you can do here */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-3xl">What you can do here</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Start wherever you are — with a place you have always wanted to see, a journey someone
          else has already mapped, or a blank page.
        </p>

        <div className="tg-stagger mt-8 grid gap-4 sm:grid-cols-2">
          {OFFERS.map(({ href, icon: Icon, title, body }) => (
            <Link
              key={href}
              href={href}
              className="flex gap-4 rounded-card border border-border bg-card p-6 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary active:translate-y-0"
            >
              <Icon aria-hidden className="h-7 w-7 shrink-0 text-primary" />
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Contact (D24): the admin edits this from the console at any time;
          rows only render when the field is filled in - never fabricated. */}
      {settings && showContact && (
        <section aria-label="Contact TravelGhana" className="mx-auto max-w-6xl px-6 pb-16">
          <div className="tg-stagger rounded-card border border-border bg-card p-6 md:p-8">
            <p className="text-sm font-medium uppercase tracking-widest text-secondary">
              Talk to a real person
            </p>
            <h2 className="mt-2 font-display text-3xl">We answer from Accra.</h2>
            {hasContactInfo(settings) && (
              <address className="mt-5 grid gap-3 text-sm not-italic sm:grid-cols-2">
                {settings.phone && (
                  <a
                    href={telHref(settings.phone)}
                    className="flex items-center gap-2 font-medium transition-colors hover:text-primary"
                  >
                    <Phone aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                    {settings.phone}
                  </a>
                )}
                {settings.whatsapp && (
                  <a
                    href={waMeHref(settings.whatsapp)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-2 font-medium transition-colors hover:text-primary"
                  >
                    <MessageCircle aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                    WhatsApp {settings.whatsapp}
                  </a>
                )}
                {settings.email && (
                  <a
                    href={`mailto:${settings.email}`}
                    className="flex items-center gap-2 font-medium transition-colors hover:text-primary"
                  >
                    <Mail aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                    {settings.email}
                  </a>
                )}
                {settings.address && (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <MapPin aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                    {settings.address}
                  </span>
                )}
              </address>
            )}
            {socials.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
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
                      className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <Icon aria-hidden className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Closing CTA over the cloud sky, echoing the homepage hero. */}
      <section className="relative isolate overflow-hidden text-white">
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-[#3f82d8] bg-cover bg-center bg-[url('/hero-sky.svg')]"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[#04204d]/70" />

        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <p className="text-sm font-medium uppercase tracking-widest text-secondary">
            Ready when you are
          </p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl md:text-4xl">
            Start with a journey, or start with a feeling.
          </h2>
          <p className="mt-3 max-w-xl text-white/85">
            Browse created packages, or open the planner and build your own route through Ghana.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/packages"
              className="inline-flex items-center gap-2 rounded-card bg-secondary px-6 py-3 font-semibold text-[color:var(--tg-text-primary)] transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.98]"
            >
              <Sparkles aria-hidden className="h-5 w-5" />
              Browse packages
            </Link>
            <Link
              href="/plan"
              className="inline-flex items-center gap-2 rounded-card border border-white/40 bg-white/5 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-[background-color,transform] duration-150 hover:bg-white/15 active:scale-[0.98]"
            >
              <Route aria-hidden className="h-5 w-5" />
              Plan my trip
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
