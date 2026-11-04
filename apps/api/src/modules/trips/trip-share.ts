import type { Prisma } from "@travelghana/database";
import type {
  ItineraryItemType,
  TripInterest,
  TravelPace,
  TripShareDayView,
  TripShareItemView,
  TripShareView,
} from "@travelghana/types";

/**
 * Pure projection from a fully-loaded trip graph to the sanitized share view
 * (D19). Keeping it pure makes the privacy rules unit-testable:
 *
 *   Included: name, dates, party size, interests, pace, per-day places and
 *             times, unscheduled idea titles.
 *   Excluded: budget + estimates, per-item and trip notes, planner warnings,
 *             traveler records and needs (§11), booking refs, owner identity.
 */

const itemSelect = {
  id: true,
  title: true,
  itemType: true,
  startTime: true,
  endTime: true,
  sortOrder: true,
  createdAt: true,
  destination: { select: { name: true } },
  attraction: { select: { name: true } },
  tour: { select: { title: true } },
  experience: { select: { title: true } },
  package: { select: { title: true } },
} satisfies Prisma.ItineraryItemSelect;

type SharedItem = Prisma.ItineraryItemGetPayload<{ select: typeof itemSelect }>;
type SharedDay = Prisma.ItineraryDayGetPayload<{ include: { items: { select: typeof itemSelect } } }>;

/** Loads exactly the columns the sanitized view needs — nothing private. */
export const tripShareInclude = {
  days: {
    orderBy: [{ dayNumber: "asc" as const }],
    include: { items: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }], select: itemSelect } },
  },
  // Trip-level "ideas tray": only items with no assigned day are relevant.
  items: {
    where: { itineraryDayId: null },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: itemSelect,
  },
} satisfies Prisma.TripInclude;

type SharedTrip = Prisma.TripGetPayload<{ include: typeof tripShareInclude }>;

/** Place name attached to an itinerary item, if any. */
export function sharePlaceName(item: SharedItem): string | null {
  return (
    item.destination?.name ??
    item.attraction?.name ??
    item.tour?.title ??
    item.experience?.title ??
    item.package?.title ??
    null
  );
}

function toIsoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toClock(value: Date | null): string | null {
  return value ? value.toISOString().slice(11, 16) : null;
}

function toItems(items: SharedItem[]): TripShareItemView[] {
  return items
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
    .map((item) => ({
      title: item.title,
      itemType: item.itemType as ItineraryItemType,
      startTime: toClock(item.startTime),
      endTime: toClock(item.endTime),
      placeName: sharePlaceName(item),
    }));
}

function toDays(days: SharedDay[]): TripShareDayView[] {
  return days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day) => ({
      dayNumber: day.dayNumber,
      date: toIsoDate(day.date),
      title: day.title,
      items: toItems(day.items),
    }));
}

export function buildTripShareView(trip: SharedTrip): TripShareView {
  return {
    name: trip.name,
    startDate: toIsoDate(trip.startDate),
    endDate: toIsoDate(trip.endDate),
    adults: trip.adults,
    children: trip.children,
    interests: (trip.interests as TripInterest[]) ?? [],
    travelPace: trip.travelPace as TravelPace,
    days: toDays(trip.days),
    unscheduledTitles: toItems(trip.items).map((idea) => idea.title),
    generatedAt: new Date().toISOString(),
  };
}
