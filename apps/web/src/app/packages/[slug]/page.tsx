/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Check,
  MapPin,
  MessageCircle,
  Route,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";

import { formatGhs } from "@/lib/format";
import { fetchPackageBySlug, fetchPackageReviews } from "@/lib/packages";
import { fetchSiteSettings, waMeHref } from "@/lib/site-settings";
import { JsonLd } from "@/components/seo/json-ld";
import { BookingPanel } from "@/components/packages/booking-panel";
import { ReviewForm } from "@/components/packages/review-form";
import { Star } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

function splitLines(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await fetchPackageBySlug(slug);
  if (!pkg) return { title: "Package not found · TravelGhana" };

  const description =
    pkg.summary ??
    pkg.description?.slice(0, 160) ??
    `A ${pkg.durationDays}-day journey in Ghana, created by TravelGhana.`;

  return {
    title: `${pkg.title} · TravelGhana`,
    description,
    alternates: { canonical: `/packages/${pkg.slug}` },
    openGraph: {
      title: `${pkg.title} · TravelGhana`,
      description,
      type: "article",
      images: pkg.heroImageUrl ? [{ url: pkg.heroImageUrl, alt: pkg.title }] : undefined,
    },
  };
}

export default async function PackageDetailPage({ params }: Props) {
  const { slug } = await params;
  const [pkg, settings, reviews] = await Promise.all([
    fetchPackageBySlug(slug),
    fetchSiteSettings(),
    fetchPackageReviews(slug),
  ]);
  if (!pkg) notFound();

  const destination = pkg.destination
    ? [pkg.destination.name, pkg.destination.regionName].filter(Boolean).join(" · ")
    : "Ghana";
  const inclusions = splitLines(pkg.inclusions);
  const exclusions = splitLines(pkg.exclusions);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  const pageUrl = `${siteUrl}/packages/${pkg.slug}`;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pkg.title,
    description: pkg.summary ?? pkg.description?.slice(0, 300) ?? undefined,
    image: pkg.heroImageUrl ?? undefined,
    brand: { "@type": "Brand", name: "TravelGhana" },
    offers: {
      "@type": "Offer",
      url: pageUrl,
      price: (pkg.priceMinor / 100).toFixed(2),
      priceCurrency: pkg.currencyCode,
      availability: "https://schema.org/InStock",
    },
    // Aggregate rating only from data this page actually renders (approved
    // reviews, D42) - never placeholder numbers.
    ...(reviews && reviews.summary.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviews.summary.average,
            reviewCount: reviews.summary.count,
          },
        }
      : {}),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Packages", item: `${siteUrl}/packages` },
      { "@type": "ListItem", position: 3, name: pkg.title, item: pageUrl },
    ],
  };

  return (
    <main>
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        {pkg.heroImageUrl ? (
          <img
            src={pkg.heroImageUrl}
            alt=""
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50"
          />
        ) : (
          <div
            aria-hidden
            className="absolute -right-16 top-1/2 -z-10 h-96 w-96 -translate-y-1/2 rounded-full bg-secondary/25 blur-3xl"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-primary via-primary/80 to-primary/30"
        />

        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <Link
            href="/packages"
            className="inline-flex items-center gap-2 text-sm text-primary-foreground/80 transition-colors hover:text-primary-foreground"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" /> All packages
          </Link>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <CalendarDays aria-hidden className="h-3.5 w-3.5" />
              {pkg.durationDays} days / {pkg.durationNights} nights
            </span>
            {pkg.featured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-[color:var(--tg-text-primary)]">
                <Sparkles aria-hidden className="h-3.5 w-3.5" /> Featured journey
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 max-w-4xl font-display text-4xl leading-tight md:text-6xl">
            {pkg.title}
          </h1>
          {pkg.summary ? (
            <p className="mt-4 max-w-2xl text-lg text-primary-foreground/85">{pkg.summary}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-primary-foreground/80">
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden className="h-4 w-4" /> {destination}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden className="h-4 w-4" /> {pkg.durationDays} days
            </span>
            <span className="font-semibold text-secondary">
              From {formatGhs(pkg.priceMinor)}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 pb-24 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-10">
          {pkg.description ? (
            <section>
              <h2 className="font-display text-2xl">About this journey</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {pkg.description}
              </p>
            </section>
          ) : null}

          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">Day by day</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The outline created by TravelGhana.
                </p>
              </div>
              {pkg.days.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {pkg.days.length} {pkg.days.length === 1 ? "day" : "days"} written
                </span>
              ) : null}
            </div>

            {pkg.days.length > 0 ? (
              <div className="tg-stagger mt-5 flex flex-col gap-4">
                {pkg.days.map((day) => (
                  <article
                    key={day.id}
                    aria-label={`Day ${day.dayNumber}: ${day.title}`}
                    className="flex gap-4 rounded-card border border-border bg-card p-5"
                  >
                    <div
                      aria-hidden
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-lg text-primary"
                    >
                      {day.dayNumber}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-xl">{day.title}</h3>
                      {day.description ? (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {day.description}
                        </p>
                      ) : null}
                      {day.meals || day.accommodation ? (
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {day.meals ? (
                            <span className="inline-flex items-center gap-1">
                              <Utensils aria-hidden className="h-3.5 w-3.5" /> {day.meals}
                            </span>
                          ) : null}
                          {day.accommodation ? (
                            <span className="inline-flex items-center gap-1">
                              <BedDouble aria-hidden className="h-3.5 w-3.5" />{" "}
                              {day.accommodation}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-card border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                The day-by-day outline for this journey is still being written.
              </p>
            )}
          </section>

          {inclusions.length > 0 || exclusions.length > 0 ? (
            <section>
              <h2 className="font-display text-2xl">What to expect</h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {inclusions.length > 0 ? (
                  <div className="rounded-card border border-border bg-card p-5">
                    <h3 className="font-medium">Included</h3>
                    <ul className="mt-3 flex flex-col gap-2">
                      {inclusions.map((item) => (
                        <li
                          key={item}
                          className="flex gap-2 text-sm text-muted-foreground"
                        >
                          <Check
                            aria-hidden
                            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {exclusions.length > 0 ? (
                  <div className="rounded-card border border-border bg-card p-5">
                    <h3 className="font-medium">Not included</h3>
                    <ul className="mt-3 flex flex-col gap-2">
                      {exclusions.map((item) => (
                        <li
                          key={item}
                          className="flex gap-2 text-sm text-muted-foreground"
                        >
                          <X aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section aria-label="Traveler reviews">
            <h2 className="font-display text-2xl">Traveler reviews</h2>
            {reviews && reviews.summary.count > 0 ? (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 font-semibold text-secondary"
                    aria-label={`Average rating ${reviews.summary.average} out of 5 from ${reviews.summary.count} approved reviews`}
                  >
                    <Star aria-hidden className="h-5 w-5" fill="currentColor" />
                    {reviews.summary.average!.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    based on {reviews.summary.count} traveler{" "}
                    {reviews.summary.count === 1 ? "review" : "reviews"} · every review is
                    from a confirmed booking and moderated by our team
                  </span>
                </div>
                <div className="tg-stagger mt-5 flex flex-col gap-4">
                  {reviews.items.map((review) => (
                    <article
                      key={review.id}
                      className="rounded-card border border-border bg-card p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span
                          className="inline-flex items-center gap-1 text-sm font-semibold text-secondary"
                          aria-label={`${review.rating} out of 5`}
                        >
                          <Star aria-hidden className="h-4 w-4" fill="currentColor" />
                          {review.rating}/5
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      {review.body ? (
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                          {review.body}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs font-medium text-foreground">
                        {review.authorName}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 rounded-card border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                No reviews yet. Travelers who completed this journey can share their
                experience - each one is confirmed by our team before it appears here.
              </p>
            )}
            <ReviewForm packageId={pkg.id} />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              From
            </p>
            <p className="mt-1 font-display text-3xl text-primary">
              {formatGhs(pkg.priceMinor)}
            </p>
            <p className="text-xs text-muted-foreground">
              per person · {pkg.currencyCode}
            </p>

            <dl className="mt-5 flex flex-col gap-3 border-t border-border pt-5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-medium">
                  {pkg.durationDays} days / {pkg.durationNights} nights
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Destination</dt>
                <dd className="text-right font-medium">{destination}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Outline</dt>
                <dd className="font-medium">{pkg.days.length} days</dd>
              </div>
            </dl>

            <BookingPanel packageId={pkg.id} slug={pkg.slug} />

            {settings?.whatsapp ? (
              <a
                href={waMeHref(
                  settings.whatsapp,
                  `Hello TravelGhana! I have a question about the "${pkg.title}" package.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-card border border-[#25D366]/60 px-5 py-3 text-sm font-medium text-[#128C4A] transition-[border-color,transform] duration-150 hover:border-[#25D366] active:scale-[0.98]"
              >
                <MessageCircle aria-hidden className="h-4 w-4" /> Ask on WhatsApp
              </a>
            ) : null}

            <Link
              href="/plan"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-card border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-[0.98]"
            >
              <Route aria-hidden className="h-4 w-4" /> Or plan a custom trip
            </Link>
            <Link
              href="/packages"
              className="mt-2 inline-flex w-full items-center justify-center rounded-card border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-[0.98]"
            >
              Browse all packages
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
