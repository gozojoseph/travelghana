import type { Metadata } from "next";
import Link from "next/link";

import { DestinationCard } from "@/components/destinations/destination-card";
import { fetchDestinations } from "@/lib/destinations";

export const metadata: Metadata = {
  title: "Destinations in Ghana",
  description:
    "Browse every TravelGhana destination guide — beaches, heritage sites, national parks and cities across Ghana's sixteen regions.",
  alternates: { canonical: "/destinations" },
};

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;

  const list = await fetchDestinations({ page, pageSize: 12 });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl md:text-4xl">Destinations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {list ? `${list.total} guides across Ghana` : "TravelGhana destination guides"}
      </p>

      {!list || list.items.length === 0 ? (
        <p className="animate-rise mt-10 rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
          Destination guides are being prepared. Check back soon.
        </p>
      ) : (
        <>
          <div className="tg-stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.items.map((d) => (
              <DestinationCard key={d.id} destination={d} />
            ))}
          </div>
          {list.pages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex justify-center gap-2">
              {Array.from({ length: list.pages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/destinations?page=${p}`}
                  aria-current={p === list.page ? "page" : undefined}
                  className={`rounded-card px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-150 active:scale-95 ${
                    p === list.page ? "bg-primary text-primary-foreground" : "border border-border"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
