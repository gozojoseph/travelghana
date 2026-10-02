import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";

import { MapView } from "@/components/maps/map-view";
import { fetchDestinationBySlug } from "@/lib/destinations";
import { CATEGORY_LABELS, type DestinationCategory } from "@/lib/destinations";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const destination = await fetchDestinationBySlug(slug);
  if (!destination) return { title: "Destination not found" };
  return {
    title: destination.name,
    description: destination.summary ?? undefined,
    alternates: { canonical: `/destinations/${destination.slug}` },
    openGraph: {
      title: `${destination.name} · TravelGhana`,
      description: destination.summary ?? undefined,
      type: "article",
    },
  };
}

export default async function DestinationDetailPage({ params }: Props) {
  const { slug } = await params;
  const destination = await fetchDestinationBySlug(slug);
  if (!destination) notFound();

  const category = destination.category as DestinationCategory;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: destination.name,
    description: destination.description ?? destination.summary ?? undefined,
    geo: { "@type": "GeoCoordinates", latitude: destination.lat, longitude: destination.lng },
    address: {
      "@type": "PostalAddress",
      addressLocality: destination.city.name,
      addressRegion: destination.city.region.name,
      addressCountry: "GH",
    },
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/explore" className="hover:underline">
          Explore Ghana
        </Link>
        <span aria-hidden className="mx-2">
          /
        </span>
        <span>
          {destination.city.name}, {destination.city.region.name}
        </span>
      </nav>

      <header className="mt-4">
        <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
          {CATEGORY_LABELS[category] ?? category}
        </span>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">{destination.name}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin aria-hidden className="h-4 w-4" />
          {destination.city.name} · {destination.city.region.name} · Ghana
        </p>
        {destination.summary && <p className="mt-4 text-lg">{destination.summary}</p>}
      </header>

      {destination.description && (
        <section className="mt-8">
          <h2 className="font-display text-2xl">About</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">{destination.description}</p>
        </section>
      )}

      <section className="mt-8" aria-label="Location">
        <h2 className="font-display text-2xl">Location</h2>
        <div className="mt-4">
          <MapView
            zoom={13}
            className="h-[320px] w-full"
            markers={[
              {
                lat: destination.lat,
                lng: destination.lng,
                label: destination.name,
                href: `https://www.openstreetmap.org/?mlat=${destination.lat}&mlon=${destination.lng}#map=14/${destination.lat}/${destination.lng}`,
              },
            ]}
          />
        </div>
      </section>

      {destination.attractions.length > 0 && (
        <section className="mt-8" aria-label="Attractions nearby">
          <h2 className="font-display text-2xl">Highlights</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {destination.attractions.map((a) => (
              <li key={a.id} className="rounded-card border border-border bg-card p-4">
                <p className="font-medium">{a.name}</p>
                {a.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
