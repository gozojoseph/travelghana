import type {
  BudgetTier,
  BudgetType,
  ItineraryDay,
  ItineraryItem,
  TravelPace,
  TripDestinationOption,
  TripDetail,
  TripInterest,
} from "@travelghana/types";

import { withSummary, type TripSummarySource } from "./summary";

/**
 * Demo data for the frontend-first trip planner (Phase A).
 *
 * Destination options reuse the real seeded names/slugs from
 * `packages/database/prisma/seed.ts`, so Phase C links resolve against the
 * database without renaming anything.
 */

export const DESTINATION_OPTIONS: TripDestinationOption[] = [
  { id: "cape-coast-castle", slug: "cape-coast-castle", name: "Cape Coast Castle", cityName: "Cape Coast", regionName: "Central" },
  { id: "elmina-castle", slug: "elmina-castle", name: "Elmina Castle", cityName: "Elmina", regionName: "Central" },
  { id: "kakum-national-park", slug: "kakum-national-park", name: "Kakum National Park", cityName: "Cape Coast", regionName: "Central" },
  { id: "kwame-nkrumah-memorial-park", slug: "kwame-nkrumah-memorial-park", name: "Kwame Nkrumah Memorial Park", cityName: "Accra", regionName: "Greater Accra" },
  { id: "independence-square", slug: "independence-square", name: "Independence Square & Black Star Gate", cityName: "Accra", regionName: "Greater Accra" },
  { id: "labadi-beach", slug: "labadi-beach", name: "Labadi Beach", cityName: "Accra", regionName: "Greater Accra" },
  { id: "jamestown-lighthouse", slug: "jamestown-lighthouse", name: "Jamestown Lighthouse", cityName: "Accra", regionName: "Greater Accra" },
  { id: "makola-market", slug: "makola-market", name: "Makola Market", cityName: "Accra", regionName: "Greater Accra" },
  { id: "shai-hills-resource-reserve", slug: "shai-hills-resource-reserve", name: "Shai Hills Resource Reserve", cityName: "Tema", regionName: "Greater Accra" },
  { id: "aburi-botanical-gardens", slug: "aburi-botanical-gardens", name: "Aburi Botanical Gardens", cityName: "Aburi", regionName: "Eastern" },
  { id: "boti-falls", slug: "boti-falls", name: "Boti Falls", cityName: "Koforidua", regionName: "Eastern" },
  { id: "wli-waterfalls", slug: "wli-waterfalls", name: "Wli Waterfalls", cityName: "Ho", regionName: "Volta" },
  { id: "mount-afadja", slug: "mount-afadja", name: "Mount Afadja", cityName: "Ho", regionName: "Volta" },
  { id: "mole-national-park", slug: "mole-national-park", name: "Mole National Park", cityName: "Damango", regionName: "Savannah" },
  { id: "larabanga-mosque", slug: "larabanga-mosque", name: "Larabanga Mosque", cityName: "Damango", regionName: "Savannah" },
  { id: "busua-beach", slug: "busua-beach", name: "Busua Beach", cityName: "Takoradi", regionName: "Western" },
];

function destination(id: string): TripDestinationOption | null {
  const option = DESTINATION_OPTIONS.find((d) => d.id === id);
  return option ?? null;
}

function destinationRef(id: string): TripDetail["days"][number]["items"][number]["destination"] {
  const option = destination(id);
  if (!option) return null;
  return {
    id: option.id,
    slug: option.slug,
    name: option.name,
    cityName: option.cityName,
    regionName: option.regionName,
  };
}

/** Optional new fields filled with safe defaults by `normalizeItem`. */
type FixtureItemExtra =
  | "attraction"
  | "tour"
  | "experience"
  | "package"
  | "estimatedCostMinor"
  | "currencyCode"
  | "pricingBasis"
  | "estimateSource"
  | "priceSnapshotAt";

type FixtureItem = Omit<ItineraryItem, FixtureItemExtra> &
  Partial<Pick<ItineraryItem, FixtureItemExtra>>;

type FixtureDay = Omit<ItineraryDay, "items"> & { items: FixtureItem[] };

/** Raw fixtures omit D18 fields so their day content stays readable. */
interface FixtureTrip
  extends Omit<
    TripDetail,
    | "days"
    | "unscheduledItems"
    | "summary"
    | "interests"
    | "travelPace"
    | "budgetTier"
    | "budgetType"
    | "budgetIncludesFlights"
    | "arrivalPoint"
    | "destinationPreferences"
  > {
  days: FixtureDay[];
  unscheduledItems?: FixtureItem[];
  interests?: TripInterest[];
  travelPace?: TravelPace;
  budgetTier?: BudgetTier;
  budgetType?: BudgetType;
  budgetIncludesFlights?: boolean;
  arrivalPoint?: string | null;
  destinationPreferences?: string[];
}

function normalizeItem(item: FixtureItem): ItineraryItem {
  return {
    ...item,
    attraction: item.attraction ?? null,
    tour: item.tour ?? null,
    experience: item.experience ?? null,
    package: item.package ?? null,
    estimatedCostMinor: item.estimatedCostMinor ?? null,
    currencyCode: item.currencyCode ?? null,
    pricingBasis: item.pricingBasis ?? null,
    estimateSource: item.estimateSource ?? null,
    priceSnapshotAt: item.priceSnapshotAt ?? null,
  };
}

/** Fixed demo trips; dates sit ahead of the current demo period and never drift. */
const RAW_TRIPS: FixtureTrip[] = [
  {
    id: "trip-cape-coast-heritage",
    name: "Cape Coast heritage weekend",
    startDate: "2026-11-06",
    endDate: "2026-11-08",
    status: "PLANNING",
    adults: 2,
    children: 1,
    budgetMinor: 450000,
    currencyCode: "GHS",
    notes: "Focus on history and the canopy walk. Keep Friday light after the drive from Accra.",
    interests: ["CULTURE_HERITAGE", "NATURE_WILDLIFE", "FAMILY_FRIENDLY"],
    travelPace: "BALANCED",
    budgetTier: "MIDRANGE",
    budgetType: "PER_GROUP",
    budgetIncludesFlights: false,
    arrivalPoint: "Kotoka International Airport (ACC)",
    destinationPreferences: ["cape-coast-castle", "kakum-national-park", "elmina-castle"],
    travelers: [
      {
        id: "trav-ama",
        name: "Ama Mensah",
        ageGroup: "Adult",
        needs: [{ id: "need-ama-1", category: "DIETARY", details: "No shellfish" }],
      },
      {
        id: "trav-kwame",
        name: "Kwame Mensah",
        ageGroup: "Adult",
        needs: [],
      },
      {
        id: "trav-esi",
        name: "Esi Mensah",
        ageGroup: "Child",
        needs: [
          {
            id: "need-esi-1",
            category: "CHILDREN",
            details: "Needs a car seat and early dinners",
          },
        ],
      },
    ],
    days: [
      {
        id: "day-cc-1",
        dayNumber: 1,
        date: "2026-11-06",
        title: "Arrival & Cape Coast Castle",
        notes: null,
        items: [
          {
            id: "item-cc-1",
            title: "Drive from Accra to Cape Coast",
            itemType: "NOTE",
            startTime: "2026-11-06T08:00:00.000Z",
            endTime: "2026-11-06T11:00:00.000Z",
            notes: "About 3 hours on the coastal road; stop in Mankessim for breakfast.",
            sortOrder: 0,
            destination: null,
            createdAt: "2026-10-12T09:00:00.000Z",
          },
          {
            id: "item-cc-2",
            title: "Guided tour of Cape Coast Castle",
            itemType: "ATTRACTION",
            startTime: "2026-11-06T14:00:00.000Z",
            endTime: "2026-11-06T16:30:00.000Z",
            notes: "Allow time for the museum after the door-of-no-return walk-through.",
            sortOrder: 1,
            destination: destinationRef("cape-coast-castle"),
            createdAt: "2026-10-12T09:00:00.000Z",
          },
          {
            id: "item-cc-3",
            title: "Dinner at a seafront chop bar",
            itemType: "RESTAURANT",
            startTime: "2026-11-06T19:00:00.000Z",
            endTime: null,
            notes: "Try banku with grilled tilapia.",
            sortOrder: 2,
            destination: null,
            createdAt: "2026-10-12T09:00:00.000Z",
          },
        ],
      },
      {
        id: "day-cc-2",
        dayNumber: 2,
        date: "2026-11-07",
        title: "Kakum rainforest",
        notes: null,
        items: [
          {
            id: "item-cc-4",
            title: "Transfer to Kakum National Park",
            itemType: "TRANSPORT",
            startTime: "2026-11-07T07:30:00.000Z",
            endTime: "2026-11-07T08:30:00.000Z",
            notes: null,
            sortOrder: 0,
            destination: destinationRef("kakum-national-park"),
            createdAt: "2026-10-12T09:00:00.000Z",
          },
          {
            id: "item-cc-5",
            title: "Canopy walkway + guided forest trail",
            itemType: "ATTRACTION",
            startTime: "2026-11-07T09:00:00.000Z",
            endTime: "2026-11-07T12:30:00.000Z",
            notes: "Go early — the walkway gets busy and hot by midday.",
            sortOrder: 1,
            destination: destinationRef("kakum-national-park"),
            createdAt: "2026-10-12T09:00:00.000Z",
          },
          {
            id: "item-cc-6",
            title: "Lunch at the park visitor centre",
            itemType: "RESTAURANT",
            startTime: "2026-11-07T13:00:00.000Z",
            endTime: null,
            notes: null,
            sortOrder: 2,
            destination: null,
            createdAt: "2026-10-12T09:00:00.000Z",
          },
        ],
      },
      {
        id: "day-cc-3",
        dayNumber: 3,
        date: "2026-11-08",
        title: "Elmina & return",
        notes: null,
        items: [
          {
            id: "item-cc-7",
            title: "Elmina Castle tour",
            itemType: "ATTRACTION",
            startTime: "2026-11-08T09:30:00.000Z",
            endTime: "2026-11-08T11:30:00.000Z",
            notes: null,
            sortOrder: 0,
            destination: destinationRef("elmina-castle"),
            createdAt: "2026-10-12T09:00:00.000Z",
          },
          {
            id: "item-cc-8",
            title: "Drive back to Accra",
            itemType: "NOTE",
            startTime: "2026-11-08T13:00:00.000Z",
            endTime: "2026-11-08T16:00:00.000Z",
            notes: "Leave before the evening rush into Accra.",
            sortOrder: 1,
            destination: null,
            createdAt: "2026-10-12T09:00:00.000Z",
          },
        ],
      },
    ],
    unscheduledItems: [
      {
        id: "item-cc-idea-1",
        title: "Cape Coast cooking class",
        itemType: "EXPERIENCE",
        startTime: null,
        endTime: null,
        notes: "An idea for the free afternoon if the castle tour finishes early.",
        sortOrder: 0,
        destination: destinationRef("cape-coast-castle"),
        createdAt: "2026-10-15T14:30:00.000Z",
      },
      {
        id: "item-cc-idea-2",
        title: "Sunset walk along the Elmina lagoon",
        itemType: "NOTE",
        startTime: null,
        endTime: null,
        notes: null,
        sortOrder: 1,
        destination: destinationRef("elmina-castle"),
        createdAt: "2026-10-15T14:30:00.000Z",
      },
    ],
    createdAt: "2026-10-12T09:00:00.000Z",
    updatedAt: "2026-10-15T14:30:00.000Z",
  },
  {
    id: "trip-accra-city-food",
    name: "Accra city & food",
    startDate: "2026-11-20",
    endDate: "2026-11-21",
    status: "PLANNING",
    adults: 2,
    children: 0,
    budgetMinor: 180000,
    currencyCode: "GHS",
    notes: "A relaxed two days — markets, history and live highlife.",
    interests: ["FOOD_CUISINE", "CULTURE_HERITAGE", "NIGHTLIFE_ENTERTAINMENT"],
    travelPace: "BALANCED",
    budgetTier: "MIDRANGE",
    budgetType: "PER_GROUP",
    budgetIncludesFlights: false,
    arrivalPoint: null,
    destinationPreferences: ["makola-market", "jamestown-lighthouse", "labadi-beach"],
    travelers: [
      {
        id: "trav-daniel",
        name: "Daniel Osei",
        ageGroup: "Adult",
        needs: [],
      },
      {
        id: "trav-nadia",
        name: "Nadia Osei",
        ageGroup: "Adult",
        needs: [{ id: "need-nadia-1", category: "DIETARY", details: "Vegetarian" }],
      },
    ],
    days: [
      {
        id: "day-ac-1",
        dayNumber: 1,
        date: "2026-11-20",
        title: "History & markets",
        notes: null,
        items: [
          {
            id: "item-ac-1",
            title: "Kwame Nkrumah Memorial Park",
            itemType: "ATTRACTION",
            startTime: "2026-11-20T09:30:00.000Z",
            endTime: "2026-11-20T11:30:00.000Z",
            notes: null,
            sortOrder: 0,
            destination: destinationRef("kwame-nkrumah-memorial-park"),
            createdAt: "2026-10-13T10:00:00.000Z",
          },
          {
            id: "item-ac-2",
            title: "Makola Market wander",
            itemType: "ATTRACTION",
            startTime: "2026-11-20T12:30:00.000Z",
            endTime: "2026-11-20T14:30:00.000Z",
            notes: "Go with a guide; bring small notes for bargaining.",
            sortOrder: 1,
            destination: destinationRef("makola-market"),
            createdAt: "2026-10-13T10:00:00.000Z",
          },
          {
            id: "item-ac-3",
            title: "Jamestown Lighthouse at golden hour",
            itemType: "ATTRACTION",
            startTime: "2026-11-20T16:30:00.000Z",
            endTime: "2026-11-20T18:00:00.000Z",
            notes: null,
            sortOrder: 2,
            destination: destinationRef("jamestown-lighthouse"),
            createdAt: "2026-10-13T10:00:00.000Z",
          },
        ],
      },
      {
        id: "day-ac-2",
        dayNumber: 2,
        date: "2026-11-21",
        title: "Beach & music",
        notes: null,
        items: [
          {
            id: "item-ac-4",
            title: "Labadi Beach morning",
            itemType: "ATTRACTION",
            startTime: "2026-11-21T10:00:00.000Z",
            endTime: "2026-11-21T13:00:00.000Z",
            notes: null,
            sortOrder: 0,
            destination: destinationRef("labadi-beach"),
            createdAt: "2026-10-13T10:00:00.000Z",
          },
          {
            id: "item-ac-5",
            title: "Street food crawl: waakye & kelewele",
            itemType: "RESTAURANT",
            startTime: "2026-11-21T13:30:00.000Z",
            endTime: "2026-11-21T15:00:00.000Z",
            notes: "Ask for the vegetarian options for Nadia.",
            sortOrder: 1,
            destination: null,
            createdAt: "2026-10-13T10:00:00.000Z",
          },
          {
            id: "item-ac-6",
            title: "Highlife night at a live music venue",
            itemType: "EVENT",
            startTime: "2026-11-21T20:00:00.000Z",
            endTime: "2026-11-21T23:00:00.000Z",
            notes: "Book a table; the band starts around 21:30.",
            sortOrder: 2,
            destination: null,
            createdAt: "2026-10-13T10:00:00.000Z",
          },
        ],
      },
    ],
    createdAt: "2026-10-13T10:00:00.000Z",
    updatedAt: "2026-10-16T08:15:00.000Z",
  },
  {
    id: "trip-volta-falls",
    name: "Volta waterfalls escape",
    startDate: null,
    endDate: null,
    status: "PLANNING",
    adults: 2,
    children: 0,
    budgetMinor: 320000,
    currencyCode: "GHS",
    notes: "Dates still open — pick a long weekend after the rains.",
    interests: ["NATURE_WILDLIFE", "ADVENTURE_HIKING", "RELAXATION_WELLNESS"],
    travelPace: "RELAXED",
    budgetTier: "BUDGET",
    budgetType: "PER_GROUP",
    budgetIncludesFlights: false,
    arrivalPoint: null,
    destinationPreferences: ["wli-waterfalls", "mount-afadja"],
    travelers: [
      {
        id: "trav-kofi",
        name: "Kofi Boateng",
        ageGroup: "Adult",
        needs: [
          {
            id: "need-kofi-1",
            category: "ACCESSIBILITY",
            details: "Prefers gentle walks and frequent breaks",
          },
        ],
      },
      {
        id: "trav-adjoa",
        name: "Adjoa Boateng",
        ageGroup: "Adult",
        needs: [],
      },
    ],
    days: [
      {
        id: "day-wv-1",
        dayNumber: 1,
        date: null,
        title: "Waterfall day",
        notes: null,
        items: [
          {
            id: "item-wv-1",
            title: "Wli Waterfalls lower falls walk",
            itemType: "ATTRACTION",
            startTime: null,
            endTime: null,
            notes: "Flat forest walk; wear sandals for the river crossing.",
            sortOrder: 0,
            destination: destinationRef("wli-waterfalls"),
            createdAt: "2026-10-14T11:00:00.000Z",
          },
          {
            id: "item-wv-2",
            title: "Hike to the upper falls",
            itemType: "ATTRACTION",
            startTime: null,
            endTime: null,
            notes: "Steeper hike — start early and take water.",
            sortOrder: 1,
            destination: destinationRef("wli-waterfalls"),
            createdAt: "2026-10-14T11:00:00.000Z",
          },
          {
            id: "item-wv-3",
            title: "Decide dates",
            itemType: "NOTE",
            startTime: null,
            endTime: null,
            notes: "Add trip dates and the days will be generated automatically.",
            sortOrder: 2,
            destination: null,
            createdAt: "2026-10-14T11:00:00.000Z",
          },
        ],
      },
    ],
    createdAt: "2026-10-14T11:00:00.000Z",
    updatedAt: "2026-10-14T11:00:00.000Z",
  },
];

/** Normalizes raw fixtures and computes the derived summary for each trip. */
function normalizeTrip(raw: FixtureTrip): TripDetail {
  const base: TripSummarySource = {
    ...raw,
    interests: raw.interests ?? [],
    travelPace: raw.travelPace ?? "BALANCED",
    budgetTier: raw.budgetTier ?? "FLEXIBLE",
    budgetType: raw.budgetType ?? "PER_GROUP",
    budgetIncludesFlights: raw.budgetIncludesFlights ?? false,
    arrivalPoint: raw.arrivalPoint ?? null,
    destinationPreferences: raw.destinationPreferences ?? [],
    days: raw.days.map((day) => ({
      ...day,
      items: day.items.map(normalizeItem),
    })),
    unscheduledItems: (raw.unscheduledItems ?? []).map(normalizeItem),
  };
  return withSummary(base);
}

/** Fresh, mutation-safe copy of the fixture set (used on first load and reset). */
export function seedTrips(): TripDetail[] {
  return RAW_TRIPS.map((trip) => JSON.parse(JSON.stringify(normalizeTrip(trip))) as TripDetail);
}
