import type {
  ItineraryDay,
  ItineraryItem,
  TravelerNeed,
  TripDestinationRef,
  TripDetail,
  TripTraveler,
} from "@travelghana/types";
import {
  MAX_TRIP_DAYS,
  type ItineraryDayCreateInput,
  type ItineraryDayUpdateInput,
  type ItineraryItemCreateInput,
  type ItineraryItemUpdateInput,
  type TravelerCreateInput,
  type TravelerUpdateInput,
  type TripCreateInput,
  type TripUpdateInput,
} from "@travelghana/validation";

import { addDays, combineDateAndTime, daysInclusive, parseDateOnly, shiftIsoDate } from "./date";
import { DESTINATION_OPTIONS, seedTrips } from "./fixtures";
import type { TripsSource } from "./source";
import { toTripSummary, withSummary } from "./summary";

/**
 * Phase A data source: real CRUD semantics over fixtures persisted in
 * `localStorage`. No network, no session — the UI behaves exactly as it will
 * once Phase C points the same interface at the API.
 */

const STORAGE_KEY = "tg.demo.trips.v2";
const DAY_MS = 86_400_000;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function writeTrips(trips: TripDetail[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  } catch {
    // Storage may be unavailable (private mode / quota) — keep the demo usable.
  }
}

function readTrips(): TripDetail[] {
  if (typeof window === "undefined") return seedTrips();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedTrips();
      writeTrips(seeded);
      return seeded;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const seeded = seedTrips();
      writeTrips(seeded);
      return seeded;
    }
    return parsed as TripDetail[];
  } catch {
    return seedTrips();
  }
}

/** Restores the fixture set (demo banner action). */
export function resetDemoTrips(): void {
  writeTrips(seedTrips());
}

/** Recomputes the derived summary before handing the trip to a caller. */
function refresh(trip: TripDetail): TripDetail {
  return clone(withSummary(trip));
}

function requireTrip(trips: TripDetail[], tripId: string): TripDetail {
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found");
  return trip;
}

function requireDay(trip: TripDetail, dayId: string): ItineraryDay {
  const day = trip.days.find((d) => d.id === dayId);
  if (!day) throw new Error("Itinerary day not found");
  return day;
}

function findItem(
  trip: TripDetail,
  itemId: string,
): { day: ItineraryDay | null; item: ItineraryItem } | null {
  for (const day of trip.days) {
    const item = day.items.find((i) => i.id === itemId);
    if (item) return { day, item };
  }
  const unscheduled = trip.unscheduledItems.find((i) => i.id === itemId);
  return unscheduled ? { day: null, item: unscheduled } : null;
}

function reindex(items: ItineraryItem[]): void {
  items.forEach((item, index) => {
    item.sortOrder = index;
  });
}

function makeDay(dayNumber: number, date: string | null): ItineraryDay {
  return { id: newId("day"), dayNumber, date, title: null, notes: null, items: [] };
}

function buildDays(startDate: string | null, endDate: string | null): ItineraryDay[] {
  if (startDate && endDate) {
    const count = daysInclusive(startDate, endDate);
    if (count > MAX_TRIP_DAYS) {
      throw new Error(`Trips can span at most ${MAX_TRIP_DAYS} days`);
    }
    return Array.from({ length: count }, (_, index) => makeDay(index + 1, addDays(startDate, index)));
  }
  return [makeDay(1, startDate)];
}

function resolveDestination(id: string | null | undefined): TripDestinationRef | null {
  if (!id) return null;
  const option = DESTINATION_OPTIONS.find((d) => d.id === id);
  if (!option) throw new Error("That destination is not available");
  return {
    id: option.id,
    slug: option.slug,
    name: option.name,
    cityName: option.cityName,
    regionName: option.regionName,
  };
}

function timeValue(day: ItineraryDay | null, time: string | null | undefined): string | null {
  if (!time || !day?.date) return null;
  return combineDateAndTime(day.date, time);
}

function clockTime(iso: string | null): string | null {
  return iso ? iso.slice(11, 16) : null;
}

function makeItem(
  day: ItineraryDay | null,
  sortOrder: number,
  input: ItineraryItemCreateInput,
): ItineraryItem {
  const hasCost = input.estimatedCostMinor !== null && input.estimatedCostMinor !== undefined;

  return {
    id: newId("item"),
    title: input.title,
    itemType: input.itemType,
    startTime: timeValue(day, input.startTime),
    endTime: timeValue(day, input.endTime),
    notes: input.notes || null,
    sortOrder,
    destination: resolveDestination(input.destinationId),
    // Demo mode has no listing snapshot inventory; discovery is API-backed in
    // the connected planner. A traveler-entered cost is still supported.
    attraction: null,
    tour: null,
    experience: null,
    package: null,
    estimatedCostMinor: hasCost ? input.estimatedCostMinor ?? null : null,
    currencyCode: hasCost ? input.currencyCode ?? null : null,
    pricingBasis: hasCost ? input.pricingBasis ?? null : null,
    estimateSource: hasCost ? "MANUAL" : null,
    priceSnapshotAt: null,
    createdAt: nowIso(),
  };
}

function toNeeds(needs: TravelerCreateInput["needs"]): TravelerNeed[] {
  return needs.map((need) => ({
    id: newId("need"),
    category: need.category,
    details: need.details || null,
  }));
}

/**
 * Applies the confirmed day rules to a date change:
 * - start-date moves shift existing day dates (and item times) by the delta,
 * - extending the range appends missing trailing days,
 * - shrinking never deletes days.
 */
function syncDays(
  trip: TripDetail,
  oldStart: string | null,
  newStart: string | null,
  newEnd: string | null,
): void {
  if (!newStart) return;

  if (oldStart && oldStart !== newStart) {
    const delta = Math.round(
      (parseDateOnly(newStart).getTime() - parseDateOnly(oldStart).getTime()) / DAY_MS,
    );
    for (const day of trip.days) {
      if (!day.date) continue;
      day.date = addDays(day.date, delta);
      for (const item of day.items) {
        if (item.startTime) item.startTime = shiftIsoDate(item.startTime, delta);
        if (item.endTime) item.endTime = shiftIsoDate(item.endTime, delta);
      }
    }
  }

  if (!newEnd) return;

  const first = trip.days[0];
  if (trip.days.length === 1 && first && !first.date) {
    first.date = newStart;
  }

  const existingDates = new Set(
    trip.days.map((day) => day.date).filter((date): date is string => Boolean(date)),
  );
  const lastDate = [...existingDates].sort().at(-1) ?? null;
  let dayNumber = trip.days.reduce((max, day) => Math.max(max, day.dayNumber), 0);
  const total = daysInclusive(newStart, newEnd);

  for (let index = 0; index < total; index++) {
    const date = addDays(newStart, index);
    if (existingDates.has(date)) continue;
    if (lastDate && date <= lastDate) continue;
    dayNumber += 1;
    trip.days.push(makeDay(dayNumber, date));
  }
}

export const demoSource: TripsSource = {
  async list() {
    return readTrips()
      .map(toTripSummary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(id) {
    const trip = readTrips().find((t) => t.id === id);
    return trip ? refresh(trip) : null;
  },

  async destinations() {
    return clone(DESTINATION_OPTIONS);
  },

  async create(input: TripCreateInput) {
    const trips = readTrips();
    const startDate = input.startDate ?? null;
    const endDate = input.endDate ?? null;
    const trip = withSummary({
      id: newId("trip"),
      name: input.name,
      startDate,
      endDate,
      status: "PLANNING" as const,
      adults: input.adults,
      children: input.children,
      budgetMinor: input.budgetMinor ?? null,
      currencyCode: input.currencyCode,
      notes: input.notes ?? null,
      interests: input.interests,
      travelPace: input.travelPace,
      budgetTier: input.budgetTier,
      budgetType: input.budgetType,
      budgetIncludesFlights: input.budgetIncludesFlights,
      arrivalPoint: input.arrivalPoint ?? null,
      destinationPreferences: input.destinationPreferences,
      travelers: [],
      days: buildDays(startDate, endDate),
      unscheduledItems: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    trips.push(trip);
    writeTrips(trips);
    return clone(trip);
  },

  async update(id: string, input: TripUpdateInput) {
    const trips = readTrips();
    const trip = requireTrip(trips, id);
    const oldStart = trip.startDate;

    if (input.name !== undefined) trip.name = input.name;
    if (input.adults !== undefined) trip.adults = input.adults;
    if (input.children !== undefined) trip.children = input.children;
    if (input.budgetMinor !== undefined) trip.budgetMinor = input.budgetMinor;
    if (input.currencyCode !== undefined) trip.currencyCode = input.currencyCode;
    if (input.notes !== undefined) trip.notes = input.notes;
    if (input.startDate !== undefined) trip.startDate = input.startDate;
    if (input.endDate !== undefined) trip.endDate = input.endDate;
    if (input.interests !== undefined) trip.interests = input.interests;
    if (input.travelPace !== undefined) trip.travelPace = input.travelPace;
    if (input.budgetTier !== undefined) trip.budgetTier = input.budgetTier;
    if (input.budgetType !== undefined) trip.budgetType = input.budgetType;
    if (input.budgetIncludesFlights !== undefined) {
      trip.budgetIncludesFlights = input.budgetIncludesFlights;
    }
    if (input.arrivalPoint !== undefined) trip.arrivalPoint = input.arrivalPoint;
    if (input.destinationPreferences !== undefined) {
      for (const destinationId of input.destinationPreferences) {
        resolveDestination(destinationId);
      }
      trip.destinationPreferences = input.destinationPreferences;
    }

    if (trip.endDate && !trip.startDate) {
      throw new Error("Add a start date before the end date");
    }
    if (trip.startDate && trip.endDate) {
      if (trip.endDate < trip.startDate) {
        throw new Error("The end date must be on or after the start date");
      }
      if (daysInclusive(trip.startDate, trip.endDate) > MAX_TRIP_DAYS) {
        throw new Error(`Trips can span at most ${MAX_TRIP_DAYS} days`);
      }
      syncDays(trip, oldStart, trip.startDate, trip.endDate);
    } else if (trip.startDate) {
      syncDays(trip, oldStart, trip.startDate, null);
    }

    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  async remove(id) {
    const trips = readTrips();
    const next = trips.filter((trip) => trip.id !== id);
    if (next.length === trips.length) throw new Error("Trip not found");
    writeTrips(next);
  },

  // ─── Travelers ──────────────────────────────────────────────────────────────

  async addTraveler(tripId, input: TravelerCreateInput) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    const traveler: TripTraveler = {
      id: newId("trav"),
      name: input.name || null,
      ageGroup: input.ageGroup || null,
      needs: toNeeds(input.needs),
    };
    trip.travelers.push(traveler);
    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  async updateTraveler(tripId, travelerId, input: TravelerUpdateInput) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    const traveler = trip.travelers.find((t) => t.id === travelerId);
    if (!traveler) throw new Error("Traveler not found");
    if (input.name !== undefined) traveler.name = input.name || null;
    if (input.ageGroup !== undefined) traveler.ageGroup = input.ageGroup || null;
    if (input.needs !== undefined) traveler.needs = toNeeds(input.needs);
    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  async removeTraveler(tripId, travelerId) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    const next = trip.travelers.filter((t) => t.id !== travelerId);
    if (next.length === trip.travelers.length) throw new Error("Traveler not found");
    trip.travelers = next;
    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  // ─── Days ───────────────────────────────────────────────────────────────────

  async addDay(tripId, input: ItineraryDayCreateInput) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    const lastDate =
      trip.days
        .map((day) => day.date)
        .filter((date): date is string => Boolean(date))
        .sort()
        .at(-1) ?? null;
    const date = lastDate ? addDays(lastDate, 1) : trip.startDate;
    const dayNumber = trip.days.reduce((max, day) => Math.max(max, day.dayNumber), 0) + 1;
    const day = makeDay(dayNumber, date);
    day.title = input.title || null;
    day.notes = input.notes || null;
    trip.days.push(day);
    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  async updateDay(tripId, dayId, input: ItineraryDayUpdateInput) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    const day = requireDay(trip, dayId);
    if (input.title !== undefined) day.title = input.title || null;
    if (input.notes !== undefined) day.notes = input.notes || null;
    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  async removeDay(tripId, dayId) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    const day = requireDay(trip, dayId);
    if (day.items.length > 0) {
      throw new Error("Remove the activities in this day first");
    }
    trip.days = trip.days
      .filter((d) => d.id !== dayId)
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((d, index) => ({ ...d, dayNumber: index + 1 }));
    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  // ─── Items ──────────────────────────────────────────────────────────────────

  async addItem(tripId, dayId, input: ItineraryItemCreateInput) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    const day = requireDay(trip, dayId);
    day.items.push(makeItem(day, day.items.length, input));
    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  async addUnscheduledItem(tripId, input: ItineraryItemCreateInput) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    if (input.startTime || input.endTime) {
      throw new Error("Assign this idea to a day before setting a time");
    }
    trip.unscheduledItems.push(makeItem(null, trip.unscheduledItems.length, input));
    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  async updateItem(tripId, itemId, input: ItineraryItemUpdateInput) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    const found = findItem(trip, itemId);
    if (!found) throw new Error("Itinerary item not found");
    const { day, item } = found;

    if (input.title !== undefined) item.title = input.title;
    if (input.itemType !== undefined) item.itemType = input.itemType;
    if (input.notes !== undefined) item.notes = input.notes || null;
    if (input.destinationId !== undefined) item.destination = resolveDestination(input.destinationId);
    if (input.startTime !== undefined) item.startTime = timeValue(day, input.startTime);
    if (input.endTime !== undefined) item.endTime = timeValue(day, input.endTime);

    const touchesEstimate =
      input.estimatedCostMinor !== undefined ||
      input.currencyCode !== undefined ||
      input.pricingBasis !== undefined ||
      input.estimateSource !== undefined;

    if (touchesEstimate) {
      const nextCost =
        input.estimatedCostMinor !== undefined
          ? input.estimatedCostMinor
          : item.estimatedCostMinor;

      if (nextCost === null) {
        item.estimatedCostMinor = null;
        item.currencyCode = null;
        item.pricingBasis = null;
        item.estimateSource = null;
        item.priceSnapshotAt = null;
      } else {
        const nextBasis =
          input.pricingBasis !== undefined ? input.pricingBasis : item.pricingBasis;
        if (!nextBasis) {
          throw new Error("Choose how the estimate is charged (per person, per night, …)");
        }
        item.estimatedCostMinor = nextCost;
        item.currencyCode =
          input.currencyCode !== undefined ? input.currencyCode : item.currencyCode;
        item.pricingBasis = nextBasis;
        item.estimateSource = "MANUAL";
        item.priceSnapshotAt = null;
      }
    }

    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  async removeItem(tripId, itemId) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    const day = trip.days.find((d) => d.items.some((i) => i.id === itemId));
    if (day) {
      day.items = day.items.filter((item) => item.id !== itemId);
      reindex(day.items);
    } else {
      const next = trip.unscheduledItems.filter((item) => item.id !== itemId);
      if (next.length === trip.unscheduledItems.length) {
        throw new Error("Itinerary item not found");
      }
      trip.unscheduledItems = next;
      reindex(trip.unscheduledItems);
    }
    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  async reorderItems(tripId, dayId, itemIds) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    const day = requireDay(trip, dayId);
    if (itemIds.length !== day.items.length) {
      throw new Error("The reordered list must include every activity once");
    }
    const byId = new Map(day.items.map((item) => [item.id, item]));
    day.items = itemIds.map((id, index) => {
      const item = byId.get(id);
      if (!item) throw new Error("Unknown activity in the reorder list");
      return { ...item, sortOrder: index };
    });
    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  async moveItem(tripId, itemId, dayId, position) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    const found = findItem(trip, itemId);
    if (!found) throw new Error("Itinerary item not found");

    const startClock = clockTime(found.item.startTime);
    const endClock = clockTime(found.item.endTime);
    const sourceItems = found.day ? found.day.items : trip.unscheduledItems;
    sourceItems.splice(sourceItems.indexOf(found.item), 1);
    reindex(sourceItems);

    const targetDay = dayId === null ? null : requireDay(trip, dayId);
    const targetItems = targetDay ? targetDay.items : trip.unscheduledItems;

    // A time only means something on a dated day. Moving to an undated day or
    // the tray clears times rather than anchoring them to an invented date.
    if (!targetDay?.date) {
      found.item.startTime = null;
      found.item.endTime = null;
    } else {
      found.item.startTime = startClock
        ? combineDateAndTime(targetDay.date, startClock)
        : null;
      found.item.endTime = endClock ? combineDateAndTime(targetDay.date, endClock) : null;
    }

    const index =
      position === undefined
        ? targetItems.length
        : Math.max(0, Math.min(position, targetItems.length));
    targetItems.splice(index, 0, found.item);
    reindex(targetItems);

    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },

  async reorderUnscheduledItems(tripId, itemIds) {
    const trips = readTrips();
    const trip = requireTrip(trips, tripId);
    if (itemIds.length !== trip.unscheduledItems.length) {
      throw new Error("The reordered list must include every idea once");
    }
    const byId = new Map(trip.unscheduledItems.map((item) => [item.id, item]));
    trip.unscheduledItems = itemIds.map((id, index) => {
      const item = byId.get(id);
      if (!item) throw new Error("Unknown idea in the reorder list");
      return { ...item, sortOrder: index };
    });
    trip.updatedAt = nowIso();
    writeTrips(trips);
    return refresh(trip);
  },
};
