import { beforeEach, describe, expect, it, vi } from "vitest";

import { TripsService } from "./trips.service";

// PrismaService is mocked — service logic here; full DB coverage in the
// integration suite (test/trips.int.spec.ts).
const db = {
  trip: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  tripTraveler: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  travelerNeed: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  itineraryDay: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
  },
  itineraryItem: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  destination: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
};

const mailer = { send: vi.fn(async () => undefined) };

const service = new TripsService(db as never, mailer);

/** Full graph the service include expects (dates as Prisma returns them). */
function tripGraph() {
  return {
    id: "t1",
    ownerUserId: "u1",
    name: "Cape Coast heritage weekend",
    startDate: new Date("2026-11-06T00:00:00.000Z"),
    endDate: new Date("2026-11-08T00:00:00.000Z"),
    status: "PLANNING",
    adults: 2,
    children: 1,
    budgetMinor: 450000,
    currencyCode: "GHS",
    notes: null,
    interests: ["CULTURE_HERITAGE"],
    travelPace: "BALANCED",
    budgetTier: "FLEXIBLE",
    budgetType: "PER_GROUP",
    budgetIncludesFlights: false,
    arrivalPoint: null,
    destinationPreferences: [],
    createdAt: new Date("2026-10-12T09:00:00.000Z"),
    updatedAt: new Date("2026-10-15T14:30:00.000Z"),
    travelers: [
      {
        id: "tr1",
        tripId: "t1",
        name: "Esi Mensah",
        ageGroup: "Child",
        isOwner: false,
        needs: [
          {
            id: "n1",
            tripTravelerId: "tr1",
            category: "CHILDREN",
            details: "Needs a car seat",
            consentGivenAt: null,
            providerVisibility: "NONE",
            detailsVisibleToProviders: false,
          },
        ],
      },
    ],
    days: [
      {
        id: "d1",
        tripId: "t1",
        dayNumber: 1,
        date: new Date("2026-11-06T00:00:00.000Z"),
        title: "Arrival",
        notes: null,
        items: [
          {
            id: "i1",
            tripId: "t1",
            itineraryDayId: "d1",
            sortOrder: 0,
            startTime: new Date("2026-11-06T09:00:00.000Z"),
            endTime: null,
            title: "Cape Coast Castle",
            itemType: "ATTRACTION",
            bookingId: null,
            attractionId: null,
            destinationId: "dest1",
            tourId: null,
            experienceId: null,
            packageId: null,
            estimatedCostMinor: null,
            currencyCode: null,
            pricingBasis: null,
            estimateSource: null,
            priceSnapshotAt: null,
            notes: null,
            createdAt: new Date("2026-10-12T09:00:00.000Z"),
            attraction: null,
            tour: null,
            experience: null,
            package: null,
            destination: {
              id: "dest1",
              cityId: null,
              slug: "cape-coast-castle",
              name: "Cape Coast Castle",
              category: "HISTORICAL",
              summary: null,
              description: null,
              lat: 5.1,
              lng: -1.2,
              heroImageUrl: null,
              featured: false,
              published: true,
              createdAt: new Date("2026-10-01T00:00:00.000Z"),
              updatedAt: new Date("2026-10-01T00:00:00.000Z"),
              city: null,
            },
          },
        ],
      },
    ],
    items: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Trips only email when the owner row is readable; tests keep it absent.
  db.user.findUnique.mockResolvedValue(null);
});

describe("listTrips", () => {
  it("scopes to the owner and maps summary counts", async () => {
    db.trip.findMany.mockResolvedValue([
      {
        id: "t1",
        name: "Cape Coast heritage weekend",
        startDate: new Date("2026-11-06T00:00:00.000Z"),
        endDate: new Date("2026-11-08T00:00:00.000Z"),
        status: "PLANNING",
        adults: 2,
        children: 1,
        budgetMinor: 450000,
        currencyCode: "GHS",
        travelPace: "RELAXED",
        budgetTier: "MIDRANGE",
        updatedAt: new Date("2026-10-19T10:00:00.000Z"),
        _count: { travelers: 3, days: 3, items: 1 },
        days: [{ _count: { items: 2 } }, { _count: { items: 0 } }, { _count: { items: 1 } }],
      },
    ]);

    const items = await service.listTrips("u1");

    expect(db.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: "u1" } }),
    );
    expect(items[0]).toMatchObject({
      id: "t1",
      startDate: "2026-11-06",
      endDate: "2026-11-08",
      dayCount: 3,
      travelerCount: 3,
      itemCount: 4,
      unscheduledItemCount: 1,
      travelPace: "RELAXED",
      budgetTier: "MIDRANGE",
      updatedAt: "2026-10-19T10:00:00.000Z",
    });
  });
});

describe("getTrip", () => {
  it("maps the full detail and omits owner-private need fields", async () => {
    db.trip.findFirst.mockResolvedValue(tripGraph());

    const trip = await service.getTrip("u1", "t1");

    expect(db.trip.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1", ownerUserId: "u1" } }),
    );
    expect(trip).toMatchObject({
      id: "t1",
      startDate: "2026-11-06",
      status: "PLANNING",
      createdAt: "2026-10-12T09:00:00.000Z",
    });
    expect(trip.travelers[0]?.needs[0]).toEqual({
      id: "n1",
      category: "CHILDREN",
      details: "Needs a car seat",
    });
    expect(trip.travelers[0]?.needs[0]).not.toHaveProperty("consentGivenAt");
    expect(trip.days[0]?.items[0]).toMatchObject({
      startTime: "2026-11-06T09:00:00.000Z",
      endTime: null,
      estimatedCostMinor: null,
      pricingBasis: null,
      destination: {
        id: "dest1",
        slug: "cape-coast-castle",
        name: "Cape Coast Castle",
        cityName: null,
        regionName: null,
      },
    });
    expect(trip.unscheduledItems).toEqual([]);
    expect(trip.summary.counts.days).toBe(1);
    expect(trip.summary.budget.totalEstimatedMinor).toBe(0);
  });

  it("404s for missing and foreign trips alike", async () => {
    db.trip.findFirst.mockResolvedValue(null);

    await expect(service.getTrip("u2", "t1")).rejects.toMatchObject({
      code: "TRIP_NOT_FOUND",
      status: 404,
    });
  });
});

describe("mutation guards", () => {
  it("refuses to update a trip owned by someone else", async () => {
    db.trip.findUnique.mockResolvedValue({ id: "t1", ownerUserId: "other" });

    await expect(service.updateTrip("u1", "t1", { name: "Renamed trip" })).rejects.toMatchObject(
      { code: "TRIP_NOT_FOUND", status: 404 },
    );
  });

  it("refuses to delete a day that still has activities", async () => {
    db.trip.findUnique.mockResolvedValue({ id: "t1", ownerUserId: "u1" });
    db.itineraryDay.findUnique.mockResolvedValue({
      id: "d1",
      tripId: "t1",
      _count: { items: 2 },
    });

    await expect(service.removeDay("u1", "t1", "d1")).rejects.toMatchObject({
      code: "DAY_NOT_EMPTY",
      status: 400,
    });
  });

  it("rejects reorder lists that do not cover every activity", async () => {
    db.trip.findUnique.mockResolvedValue({ id: "t1", ownerUserId: "u1" });
    db.itineraryDay.findUnique.mockResolvedValue({
      id: "d1",
      tripId: "t1",
      items: [{ id: "i1" }, { id: "i2" }],
    });

    await expect(service.reorderItems("u1", "t1", "d1", ["i1"])).rejects.toMatchObject({
      code: "INVALID_REORDER",
      status: 400,
    });
  });
});

describe("unscheduled items + moves", () => {
  it("rejects a time on an idea that has no day yet", async () => {
    db.trip.findUnique.mockResolvedValue({ id: "t1", ownerUserId: "u1" });

    await expect(
      service.addUnscheduledItem("u1", "t1", {
        title: "Beach walk",
        itemType: "NOTE",
        startTime: "09:00",
      }),
    ).rejects.toMatchObject({ code: "ASSIGN_DAY_FOR_TIME", status: 400 });
  });

  it("404s when moving an item onto a day from another trip", async () => {
    db.trip.findUnique.mockResolvedValue({ id: "t1", ownerUserId: "u1" });
    db.itineraryItem.findUnique.mockResolvedValue({
      id: "i1",
      tripId: "t1",
      itineraryDayId: null,
      startTime: null,
      endTime: null,
      day: null,
    });
    db.itineraryDay.findUnique.mockResolvedValue({
      id: "d9",
      tripId: "other",
      date: null,
    });

    await expect(
      service.moveItem("u1", "t1", "i1", { dayId: "d9" }),
    ).rejects.toMatchObject({ code: "DAY_NOT_FOUND", status: 404 });
  });
});
