"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Compass,
  Landmark,
  Loader2,
  MapPin,
  Package,
  Search,
  Sparkles,
  Ticket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  PackageSummary,
  TripDestinationOption,
  TripDetail,
} from "@travelghana/types";
import type { ItineraryItemCreateInput } from "@travelghana/validation";

import { apiRequest, ApiClientError } from "@/lib/api";
import type { ExperienceDto, TourDto } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { isDemoTrips, tripsSource } from "@/lib/trips";

import { secondaryButtonClass } from "./shared";

interface CatalogList<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

interface AttractionDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  destination: { slug: string; name: string } | null;
  city: {
    slug: string;
    name: string;
    region: { slug: string; name: string } | null;
  } | null;
}

type DiscoverTab = "places" | "attractions" | "tours" | "experiences" | "packages";

const TABS: Array<{ key: DiscoverTab; label: string; icon: LucideIcon }> = [
  { key: "places", label: "Places", icon: MapPin },
  { key: "attractions", label: "Attractions", icon: Landmark },
  { key: "tours", label: "Tours", icon: Compass },
  { key: "experiences", label: "Experiences", icon: Sparkles },
  { key: "packages", label: "Packages", icon: Package },
];

interface DiscoverResult {
  key: string;
  title: string;
  meta: string;
  description?: string | null;
  /** Stable id of the linked entity, used for the duplicate guard + add. */
  refId: string;
  input: ItineraryItemCreateInput;
}

function hasItem(trip: TripDetail, predicate: (item: TripDetail["days"][number]["items"][number]) => boolean) {
  return [...trip.days.flatMap((day) => day.items), ...trip.unscheduledItems].some(predicate);
}

export function DiscoverPanel({
  trip,
  destinations,
  onChange,
  onError,
}: {
  trip: TripDetail;
  destinations: TripDestinationOption[];
  onChange: (trip: TripDetail) => void;
  onError: (message: string) => void;
}) {
  const [tab, setTab] = useState<DiscoverTab>("places");
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [catalog, setCatalog] = useState<DiscoverResult[]>([]);
  /** Request key (`tab:query:reload`) that produced `catalog`. */
  const [catalogKey, setCatalogKey] = useState<string | null>(null);
  /** Request key that last failed, so an older result is never shown as current. */
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [target, setTarget] = useState<string>("unscheduled");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const effectiveTarget =
    target === "unscheduled" || trip.days.some((day) => day.id === target)
      ? target
      : "unscheduled";

  // Places come straight from the destination options the workspace already
  // loaded, so they stay derived instead of living in effect-driven state.
  const placeResults = useMemo<DiscoverResult[]>(() => {
    const needle = query.trim().toLowerCase();
    return destinations
      .filter((destination) => {
        if (!needle) return true;
        return (
          destination.name.toLowerCase().includes(needle) ||
          (destination.cityName ?? "").toLowerCase().includes(needle) ||
          (destination.regionName ?? "").toLowerCase().includes(needle)
        );
      })
      .map((destination) => ({
        key: `place-${destination.id}`,
        title: destination.name,
        meta: [destination.cityName, destination.regionName].filter(Boolean).join(" · "),
        refId: destination.id,
        input: {
          title: destination.name,
          itemType: "ATTRACTION" as const,
          destinationId: destination.id,
        },
      }));
  }, [destinations, query]);

  const requestKey = `${tab}:${query}:${reloadKey}`;

  useEffect(() => {
    if (tab === "places" || isDemoTrips) {
      // Derived content — nothing to fetch.
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const qs = new URLSearchParams();
        if (query.trim()) qs.set("q", query.trim());
        qs.set("pageSize", "12");

        if (tab === "attractions") {
          const result = await apiRequest<CatalogList<AttractionDto>>(
            `/catalog/attractions?${qs.toString()}`,
            { signal: controller.signal },
          );
          setCatalog(
            result.items.map((attraction) => ({
              key: `attraction-${attraction.id}`,
              title: attraction.name,
              meta:
                [attraction.category, attraction.city?.name, attraction.destination?.name]
                  .filter(Boolean)
                  .join(" · ") || "Attraction",
              description: attraction.description,
              refId: attraction.id,
              input: {
                title: attraction.name,
                itemType: "ATTRACTION",
                attractionId: attraction.id,
              },
            })),
          );
        } else if (tab === "tours") {
          const result = await apiRequest<CatalogList<TourDto>>(
            `/catalog/tours?${qs.toString()}`,
            { signal: controller.signal },
          );
          setCatalog(
            result.items.map((tour) => ({
              key: `tour-${tour.id}`,
              title: tour.title,
              meta: [
                tour.provider.name,
                tour.durationHours ? `${tour.durationHours} hr` : null,
                formatMoney(tour.basePriceMinor, tour.currencyCode),
              ]
                .filter(Boolean)
                .join(" · "),
              description: tour.summary,
              refId: tour.id,
              input: { title: tour.title, itemType: "TOUR", tourId: tour.id },
            })),
          );
        } else if (tab === "experiences") {
          const result = await apiRequest<CatalogList<ExperienceDto>>(
            `/catalog/experiences?${qs.toString()}`,
            { signal: controller.signal },
          );
          setCatalog(
            result.items.map((experience) => ({
              key: `experience-${experience.id}`,
              title: experience.title,
              meta: [
                experience.provider.name,
                experience.durationMinutes ? `${experience.durationMinutes} min` : null,
                formatMoney(experience.priceMinor, experience.currencyCode),
              ]
                .filter(Boolean)
                .join(" · "),
              description: experience.description,
              refId: experience.id,
              input: {
                title: experience.title,
                itemType: "EXPERIENCE",
                experienceId: experience.id,
              },
            })),
          );
        } else {
          const result = await apiRequest<{ items: PackageSummary[] }>("/packages", {
            signal: controller.signal,
          });
          const needle = query.trim().toLowerCase();
          const items = result.items.filter(
            (pkg) =>
              !needle ||
              pkg.title.toLowerCase().includes(needle) ||
              (pkg.summary ?? "").toLowerCase().includes(needle),
          );
          setCatalog(
            items.map((pkg) => ({
              key: `package-${pkg.id}`,
              title: pkg.title,
              meta: [
                `${pkg.durationDays} ${pkg.durationDays === 1 ? "day" : "days"}`,
                pkg.destination?.name,
                formatMoney(pkg.priceMinor, pkg.currencyCode),
              ]
                .filter(Boolean)
                .join(" · "),
              description: pkg.summary,
              refId: pkg.id,
              input: { title: pkg.title, itemType: "TOUR", packageId: pkg.id },
            })),
          );
        }
        setCatalogKey(requestKey);
      } catch (error) {
        if (controller.signal.aborted) return;
        setErrorKey(requestKey);
        if (error instanceof ApiClientError && error.status === 401) {
          onError("Sign in to discover live listings.");
        }
      }
    })();

    return () => controller.abort();
  }, [tab, query, reloadKey, requestKey, onError]);

  const listingTab = tab !== "places" && !isDemoTrips;
  const catalogState: "loading" | "ready" | "error" = !listingTab
    ? "ready"
    : catalogKey === requestKey
      ? "ready"
      : errorKey === requestKey
        ? "error"
        : "loading";
  const results = !listingTab
    ? tab === "places"
      ? placeResults
      : []
    : catalogKey === requestKey
      ? catalog
      : [];

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draftQuery);
  }

  async function add(result: DiscoverResult) {
    setPendingKey(result.key);
    setNotice(null);
    try {
      const updated =
        effectiveTarget === "unscheduled"
          ? await tripsSource.addUnscheduledItem(trip.id, result.input)
          : await tripsSource.addItem(trip.id, effectiveTarget, result.input);
      onChange(updated);
      const day = updated.days.find((entry) => entry.id === effectiveTarget);
      const where = day ? `Day ${day.dayNumber}` : "your ideas";
      setNotice(`Added “${result.title}” to ${where}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not add that to your trip");
    } finally {
      setPendingKey(null);
    }
  }

  function isAdded(result: DiscoverResult): boolean {
    if (result.key.startsWith("place-")) {
      return hasItem(trip, (item) => item.destination?.id === result.refId);
    }
    if (result.key.startsWith("attraction-")) {
      return hasItem(trip, (item) => item.attraction?.id === result.refId);
    }
    if (result.key.startsWith("tour-")) {
      return hasItem(trip, (item) => item.tour?.id === result.refId);
    }
    if (result.key.startsWith("experience-")) {
      return hasItem(trip, (item) => item.experience?.id === result.refId);
    }
    return hasItem(trip, (item) => item.package?.id === result.refId);
  }

  const visibleTabs = isDemoTrips ? TABS.filter((entry) => entry.key === "places") : TABS;

  return (
    <section aria-labelledby="discover-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="discover-heading" className="font-display text-lg">
          Discover
        </h2>
        <span className="text-[11px] text-muted-foreground">Real listings only</span>
      </div>

      <nav aria-label="Discovery categories" className="flex flex-wrap gap-1.5">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setNotice(null);
            }}
            aria-pressed={tab === key}
            className={`inline-flex items-center gap-1.5 rounded-card border px-2.5 py-1.5 text-xs font-medium transition-[color,background-color,border-color] duration-150 ${
              tab === key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon aria-hidden className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>

      <form onSubmit={applySearch} className="flex items-center gap-1.5" role="search">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder={
              tab === "places"
                ? "Search places…"
                : tab === "attractions"
                  ? "Search attractions…"
                  : tab === "tours"
                    ? "Search tours…"
                    : tab === "experiences"
                      ? "Search experiences…"
                      : "Search packages…"
            }
            aria-label="Search discovery"
            className="w-full rounded-card border border-border bg-card py-2 pl-8 pr-2 text-xs outline-none transition-colors focus:border-primary"
          />
        </div>
        <button type="submit" className={`${secondaryButtonClass} px-2.5 py-2 text-xs`}>
          Search
        </button>
      </form>

      <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="shrink-0">Add to</span>
        <select
          value={effectiveTarget}
          onChange={(event) => setTarget(event.target.value)}
          className="w-full rounded-card border border-border bg-card px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
        >
          <option value="unscheduled">Ideas tray (unscheduled)</option>
          {trip.days.map((day) => (
            <option key={day.id} value={day.id}>
              Day {day.dayNumber}
              {day.title ? ` — ${day.title}` : ""}
            </option>
          ))}
        </select>
      </label>

      {notice ? (
        <p
          role="status"
          className="animate-pop rounded-card border border-secondary/60 bg-secondary/15 px-3 py-2 text-xs"
        >
          {notice}
        </p>
      ) : null}

      {catalogState === "loading" ? (
        <div aria-hidden className="flex flex-col gap-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-card border border-border bg-card"
            />
          ))}
          <span role="status" className="sr-only">
            Loading discovery…
          </span>
        </div>
      ) : null}

      {catalogState === "error" ? (
        <div className="rounded-card border border-border bg-card p-3 text-xs">
          <p className="font-medium">Discovery is unavailable right now.</p>
          <p className="mt-1 text-muted-foreground">
            The catalog could not be reached. Your trip is safe.
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className={`${secondaryButtonClass} mt-2 px-3 py-1.5 text-xs`}
          >
            Try again
          </button>
        </div>
      ) : null}

      {catalogState === "ready" && results.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card px-3 py-6 text-center">
          <BookOpen aria-hidden className="mx-auto h-6 w-6 text-primary/50" />
          <p className="mt-2 text-xs font-medium">Nothing matches yet</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {query.trim()
              ? "Try a broader search."
              : tab === "places"
                ? "Places will appear when the catalog is available."
                : "Published listings will appear here as operators add them."}
          </p>
        </div>
      ) : null}

      {catalogState === "ready" && results.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {results.map((result) => {
            const added = isAdded(result);
            const pending = pendingKey === result.key;
            return (
              <li key={result.key} className="rounded-card border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{result.title}</p>
                    {result.meta ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{result.meta}</p>
                    ) : null}
                    {result.description ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                        {result.description}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void add(result)}
                    disabled={added || pending}
                    aria-label={added ? `${result.title} is already in your trip` : `Add ${result.title}`}
                    className={`shrink-0 rounded-card px-2.5 py-1.5 text-[11px] font-semibold transition-[background-color,transform] duration-150 active:scale-[0.97] ${
                      added
                        ? "border border-border text-muted-foreground"
                        : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    }`}
                  >
                    {pending ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                    ) : added ? (
                      "Added"
                    ) : (
                      "Add"
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="mt-1 flex items-start gap-1.5 rounded-card bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
        <Ticket aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {isDemoTrips
          ? "Preview mode: live tours, experiences and packages need the API-backed planner. Places work here."
          : "Listings come from published operator inventory. Prices shown become an estimate snapshot — they are not a booking or a confirmed total."}
      </p>
    </section>
  );
}
