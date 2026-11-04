import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma.service";
import { MAILER, type Mailer } from "../src/modules/auth/mailer";

/**
 * Postgres-backed integration test of the trip planner (D12):
 * owner-scoped CRUD, generated + shifted days, travelers with owner-private
 * needs, itinerary item CRUD/reorder — foreign and missing ids return 404.
 */
const OWNER = {
  name: "Ama Planner",
  email: "int-trips-owner@example.com",
  password: "correct-horse-battery",
};
const RIVAL = {
  name: "Rita Rival",
  email: "int-trips-rival@example.com",
  password: "correct-horse-battery",
};

let app: NestExpressApplication;
let prisma: PrismaService;
let ownerCookie = "";
let rivalCookie = "";
let destinationId = "";
let tripId = "";
let travelerId = "";
let day1Id = "";
let item1Id = "";
let item2Id = "";

beforeAll(async () => {
  const testMailer: Mailer = { async send() {} };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER)
    .useValue(testMailer)
    .compile();

  app = moduleRef.createNestApplication({ logger: ["error", "warn"] });
  app.use(cookieParser());
  app.setGlobalPrefix("api"); // mirror main.ts
  await app.init();

  prisma = moduleRef.get(PrismaService);

  // Destination fixture: the planner stores a plain destination reference, so
  // the integration suite builds its own region → city → destination chain
  // instead of depending on seeded data.
  const region = await prisma.region.create({
    data: { slug: "int-trips-region", name: "Integration Region" },
    select: { id: true },
  });
  const city = await prisma.city.create({
    data: {
      regionId: region.id,
      slug: "int-trips-city",
      name: "Integration City",
      lat: 5.1,
      lng: -1.2,
    },
    select: { id: true },
  });
  const destination = await prisma.destination.create({
    data: {
      cityId: city.id,
      slug: "int-trips-castle",
      name: "Integration Castle",
      category: "HISTORICAL",
      lat: 5.1,
      lng: -1.2,
      published: true,
    },
    select: { id: true },
  });
  destinationId = destination.id;
});

afterAll(async () => {
  await app?.close();
});

function sessionCookie(res: request.Response): string {
  const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
  expect(cookies, "expected a session cookie").toBeDefined();
  const cookie = (cookies as string[]).find((c) => c.startsWith("tg_session="));
  expect(cookie, "expected tg_session cookie").toBeDefined();
  return (cookie as string).split(";")[0]!;
}

async function register(user: { name: string; email: string; password: string }): Promise<string> {
  const res = await request(app.getHttpServer()).post("/api/auth/register").send(user).expect(201);
  return sessionCookie(res);
}

describe("trip planner", () => {
  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/api/trips").expect(401);
  });

  it("creates a trip with one generated day per date", async () => {
    ownerCookie = await register(OWNER);
    rivalCookie = await register(RIVAL);

    const created = await request(app.getHttpServer())
      .post("/api/trips")
      .set("Cookie", ownerCookie)
      .send({
        name: "Cape Coast heritage weekend",
        startDate: "2026-11-06",
        endDate: "2026-11-08",
        adults: 2,
        children: 1,
        budgetMinor: 450000,
        notes: "History and the canopy walk.",
      })
      .expect(201);

    const trip = created.body.trip;
    tripId = trip.id;
    day1Id = trip.days[0].id;

    expect(trip.status).toBe("PLANNING");
    expect(trip.currencyCode).toBe("GHS");
    expect(trip).toMatchObject({
      interests: [],
      travelPace: "BALANCED",
      budgetTier: "FLEXIBLE",
      budgetType: "PER_GROUP",
      budgetIncludesFlights: false,
      arrivalPoint: null,
      destinationPreferences: [],
      unscheduledItems: [],
    });
    expect(trip.summary.budget.targetMinor).toBe(450000);
    expect(trip.days.map((day: { dayNumber: number; date: string }) => [day.dayNumber, day.date])).toEqual([
      [1, "2026-11-06"],
      [2, "2026-11-07"],
      [3, "2026-11-08"],
    ]);
    expect(trip.travelers).toEqual([]);

    const ownerList = await request(app.getHttpServer())
      .get("/api/trips")
      .set("Cookie", ownerCookie)
      .expect(200);
    expect(ownerList.body.items).toHaveLength(1);
    expect(ownerList.body.items[0]).toMatchObject({
      id: tripId,
      startDate: "2026-11-06",
      dayCount: 3,
      travelerCount: 0,
      itemCount: 0,
    });

    // Owner scoping: the rival sees an empty planner, not this trip.
    const rivalList = await request(app.getHttpServer())
      .get("/api/trips")
      .set("Cookie", rivalCookie)
      .expect(200);
    expect(rivalList.body.items).toEqual([]);
  });

  it("validates trip payloads (400 VALIDATION_ERROR)", async () => {
    const server = app.getHttpServer();

    const backwards = await request(server)
      .post("/api/trips")
      .set("Cookie", ownerCookie)
      .send({ name: "Backwards break", startDate: "2026-11-10", endDate: "2026-11-01" })
      .expect(400);
    expect(backwards.body.error.code).toBe("VALIDATION_ERROR");

    const tooLong = await request(server)
      .post("/api/trips")
      .set("Cookie", ownerCookie)
      .send({ name: "Endless tour", startDate: "2026-01-01", endDate: "2026-02-15" })
      .expect(400);
    expect(tooLong.body.error.code).toBe("VALIDATION_ERROR");

    await request(server).post("/api/trips").set("Cookie", ownerCookie).send({}).expect(400);

    // Partial updates are checked against the merged state in the service.
    const merged = await request(server)
      .patch(`/api/trips/${tripId}`)
      .set("Cookie", ownerCookie)
      .send({ endDate: "2026-11-01" })
      .expect(400);
    expect(merged.body.error.code).toBe("INVALID_TRIP_DATES");
  });

  it("hides foreign trips and unknown nested ids behind 404", async () => {
    const server = app.getHttpServer();

    const foreign = await request(server)
      .get(`/api/trips/${tripId}`)
      .set("Cookie", rivalCookie)
      .expect(404);
    expect(foreign.body.error.code).toBe("TRIP_NOT_FOUND");

    await request(server)
      .patch(`/api/trips/${tripId}`)
      .set("Cookie", rivalCookie)
      .send({ name: "Hijacked trip" })
      .expect(404);

    await request(server)
      .post(`/api/trips/${tripId}/travelers`)
      .set("Cookie", rivalCookie)
      .send({ name: "Mallory" })
      .expect(404);

    await request(server).get("/api/trips/does-not-exist").set("Cookie", ownerCookie).expect(404);

    await request(server)
      .patch(`/api/trips/${tripId}/days/does-not-exist`)
      .set("Cookie", ownerCookie)
      .send({ title: "Ghost day" })
      .expect(404);

    await request(server)
      .patch(`/api/trips/${tripId}/items/does-not-exist`)
      .set("Cookie", ownerCookie)
      .send({ title: "Ghost item" })
      .expect(404);
  });

  it("adds travelers with owner-private needs", async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/travelers`)
      .set("Cookie", ownerCookie)
      .send({
        name: "Esi Mensah",
        ageGroup: "Child",
        needs: [{ category: "CHILDREN", details: "Needs a car seat" }],
      })
      .expect(201);

    travelerId = created.body.trip.travelers[0].id;
    expect(created.body.trip.travelers[0]).toMatchObject({
      name: "Esi Mensah",
      ageGroup: "Child",
      needs: [{ category: "CHILDREN", details: "Needs a car seat" }],
    });

    // §11: the need row is created owner-private, with no consent captured.
    const need = await prisma.travelerNeed.findFirst({
      where: { tripTravelerId: travelerId },
    });
    expect(need).toMatchObject({
      category: "CHILDREN",
      providerVisibility: "NONE",
      detailsVisibleToProviders: false,
      consentGivenAt: null,
    });

    const updated = await request(app.getHttpServer())
      .patch(`/api/trips/${tripId}/travelers/${travelerId}`)
      .set("Cookie", ownerCookie)
      .send({
        ageGroup: "Adult",
        needs: [{ category: "ACCESSIBILITY", details: "Step-free access" }],
      })
      .expect(200);

    expect(updated.body.trip.travelers[0].needs).toEqual([
      { id: expect.any(String), category: "ACCESSIBILITY", details: "Step-free access" },
    ]);

    const replaced = await prisma.travelerNeed.findFirst({
      where: { tripTravelerId: travelerId },
    });
    expect(replaced).toMatchObject({
      category: "ACCESSIBILITY",
      providerVisibility: "NONE",
      detailsVisibleToProviders: false,
    });
  });

  it("manages itinerary items with times, destinations and reorder", async () => {
    const server = app.getHttpServer();
    const base = `/api/trips/${tripId}/days/${day1Id}/items`;

    const first = await request(server)
      .post(base)
      .set("Cookie", ownerCookie)
      .send({
        title: "Guided castle tour",
        itemType: "ATTRACTION",
        startTime: "09:00",
        endTime: "11:30",
        destinationId,
        notes: "Meet at the gate",
      })
      .expect(201);

    item1Id = first.body.trip.days[0].items[0].id;
    expect(first.body.trip.days[0].items[0]).toMatchObject({
      startTime: "2026-11-06T09:00:00.000Z",
      endTime: "2026-11-06T11:30:00.000Z",
      sortOrder: 0,
      destination: {
        id: destinationId,
        name: "Integration Castle",
        cityName: "Integration City",
        regionName: "Integration Region",
      },
    });

    const second = await request(server)
      .post(base)
      .set("Cookie", ownerCookie)
      .send({ title: "Lunch by the sea", itemType: "RESTAURANT", startTime: "12:30" })
      .expect(201);
    item2Id = second.body.trip.days[0].items[1].id;
    expect(second.body.trip.days[0].items[1].sortOrder).toBe(1);

    // Validation: reversed times, BOOKING (booking engine not shipped) and an
    // unknown destination are all rejected.
    await request(server)
      .post(base)
      .set("Cookie", ownerCookie)
      .send({ title: "Bad order", startTime: "14:00", endTime: "13:00" })
      .expect(400);
    await request(server)
      .post(base)
      .set("Cookie", ownerCookie)
      .send({ title: "Book me", itemType: "BOOKING" })
      .expect(400);
    const unknownDestination = await request(server)
      .post(base)
      .set("Cookie", ownerCookie)
      .send({ title: "Lost place", destinationId: "does-not-exist" })
      .expect(400);
    expect(unknownDestination.body.error.code).toBe("DESTINATION_NOT_FOUND");

    const patched = await request(server)
      .patch(`/api/trips/${tripId}/items/${item1Id}`)
      .set("Cookie", ownerCookie)
      .send({ title: "Castle tour (updated)", endTime: "12:00" })
      .expect(200);
    expect(patched.body.trip.days[0].items.find((i: { id: string }) => i.id === item1Id)).toMatchObject(
      {
        title: "Castle tour (updated)",
        endTime: "2026-11-06T12:00:00.000Z",
      },
    );

    const reordered = await request(server)
      .post(`${base}/reorder`)
      .set("Cookie", ownerCookie)
      .send({ itemIds: [item2Id, item1Id] })
      .expect(201);
    expect(reordered.body.trip.days[0].items.map((i: { id: string }) => i.id)).toEqual([
      item2Id,
      item1Id,
    ]);
    expect(reordered.body.trip.days[0].items.map((i: { sortOrder: number }) => i.sortOrder)).toEqual([
      0, 1,
    ]);

    const incomplete = await request(server)
      .post(`${base}/reorder`)
      .set("Cookie", ownerCookie)
      .send({ itemIds: [item2Id] })
      .expect(400);
    expect(incomplete.body.error.code).toBe("INVALID_REORDER");

    const afterDelete = await request(server)
      .delete(`/api/trips/${tripId}/items/${item2Id}`)
      .set("Cookie", ownerCookie)
      .expect(200);
    expect(afterDelete.body.trip.days[0].items).toHaveLength(1);
    expect(afterDelete.body.trip.days[0].items[0].sortOrder).toBe(0);
  });

  it("shifts day dates and item times when the start moves", async () => {
    const server = app.getHttpServer();

    const shifted = await request(server)
      .patch(`/api/trips/${tripId}`)
      .set("Cookie", ownerCookie)
      .send({ startDate: "2026-11-07", endDate: "2026-11-09" })
      .expect(200);

    expect(shifted.body.trip.days.map((day: { date: string }) => day.date)).toEqual([
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
    ]);
    expect(shifted.body.trip.days[0].items[0].startTime).toBe("2026-11-07T09:00:00.000Z");
    expect(shifted.body.trip.days[0].items[0].endTime).toBe("2026-11-07T12:00:00.000Z");

    const extended = await request(server)
      .patch(`/api/trips/${tripId}`)
      .set("Cookie", ownerCookie)
      .send({ endDate: "2026-11-10" })
      .expect(200);
    expect(extended.body.trip.days).toHaveLength(4);
    expect(extended.body.trip.days[3]).toMatchObject({ dayNumber: 4, date: "2026-11-10" });

    // Shrinking never deletes days.
    const shrunk = await request(server)
      .patch(`/api/trips/${tripId}`)
      .set("Cookie", ownerCookie)
      .send({ endDate: "2026-11-08" })
      .expect(200);
    expect(shrunk.body.trip.days).toHaveLength(4);
  });

  it("renumbers days after deleting an empty one and blocks non-empty deletes", async () => {
    const server = app.getHttpServer();

    const detail = await request(server)
      .get(`/api/trips/${tripId}`)
      .set("Cookie", ownerCookie)
      .expect(200);
    const days = detail.body.trip.days as Array<{ id: string; date: string }>;
    const emptyDay = days[1]!; // 2026-11-08, no activities

    const removed = await request(server)
      .delete(`/api/trips/${tripId}/days/${emptyDay.id}`)
      .set("Cookie", ownerCookie)
      .expect(200);
    expect(removed.body.trip.days.map((day: { dayNumber: number }) => day.dayNumber)).toEqual([
      1, 2, 3,
    ]);
    expect(removed.body.trip.days.map((day: { date: string }) => day.date)).toEqual([
      "2026-11-07",
      "2026-11-09",
      "2026-11-10",
    ]);

    const nonEmpty = await request(server)
      .delete(`/api/trips/${tripId}/days/${removed.body.trip.days[0].id}`)
      .set("Cookie", ownerCookie)
      .expect(400);
    expect(nonEmpty.body.error.code).toBe("DAY_NOT_EMPTY");

    const added = await request(server)
      .post(`/api/trips/${tripId}/days`)
      .set("Cookie", ownerCookie)
      .send({ title: "Waterfall day", notes: "Keep it light" })
      .expect(201);
    expect(added.body.trip.days[3]).toMatchObject({
      dayNumber: 4,
      date: "2026-11-11",
      title: "Waterfall day",
      notes: "Keep it light",
    });

    const dayUpdate = await request(server)
      .patch(`/api/trips/${tripId}/days/${added.body.trip.days[3].id}`)
      .set("Cookie", ownerCookie)
      .send({ notes: "Bring rain jackets" })
      .expect(200);
    expect(dayUpdate.body.trip.days[3].notes).toBe("Bring rain jackets");
  });

  it("dates the lone undated day when dates are added later", async () => {
    const server = app.getHttpServer();

    const undated = await request(server)
      .post("/api/trips")
      .set("Cookie", ownerCookie)
      .send({ name: "Volta falls escape" })
      .expect(201);
    expect(undated.body.trip.startDate).toBeNull();
    expect(undated.body.trip.days).toEqual([
      expect.objectContaining({ dayNumber: 1, date: null }),
    ]);

    const undatedId = undated.body.trip.id;
    const dated = await request(server)
      .patch(`/api/trips/${undatedId}`)
      .set("Cookie", ownerCookie)
      .send({ startDate: "2026-12-04", endDate: "2026-12-05" })
      .expect(200);
    expect(
      dated.body.trip.days.map((day: { dayNumber: number; date: string }) => [day.dayNumber, day.date]),
    ).toEqual([
      [1, "2026-12-04"],
      [2, "2026-12-05"],
    ]);

    await request(server)
      .delete(`/api/trips/${undatedId}`)
      .set("Cookie", ownerCookie)
      .expect(200);
  });

  it("supports wizard preferences, unscheduled ideas, moves and budget warnings", async () => {
    const server = app.getHttpServer();

    const created = await request(server)
      .post("/api/trips")
      .set("Cookie", ownerCookie)
      .send({
        name: "Budget and pace probe",
        startDate: "2026-12-01",
        endDate: "2026-12-03",
        adults: 2,
        children: 0,
        budgetMinor: 100000,
        budgetType: "PER_GROUP",
        budgetTier: "MIDRANGE",
        travelPace: "RELAXED",
        interests: ["FOOD_CUISINE", "CULTURE_HERITAGE"],
        arrivalPoint: "Kotoka International Airport (ACC)",
        destinationPreferences: [destinationId],
      })
      .expect(201);

    const probe = created.body.trip;
    const probeId = probe.id as string;
    const [day1, day2] = probe.days as Array<{ id: string }>;
    expect(probe).toMatchObject({
      travelPace: "RELAXED",
      budgetTier: "MIDRANGE",
      budgetType: "PER_GROUP",
      arrivalPoint: "Kotoka International Airport (ACC)",
      interests: ["FOOD_CUISINE", "CULTURE_HERITAGE"],
      destinationPreferences: [destinationId],
    });
    expect(probe.summary.budget).toMatchObject({
      travelers: 2,
      nights: 2,
      targetMinor: 100000,
      totalEstimatedMinor: 0,
    });

    // An idea added to the tray is budgeted but not scheduled.
    const idea = await request(server)
      .post(`/api/trips/${probeId}/items`)
      .set("Cookie", ownerCookie)
      .send({
        title: "Kente weaving workshop",
        itemType: "EXPERIENCE",
        estimatedCostMinor: 15000,
        pricingBasis: "PER_PERSON",
      })
      .expect(201);
    const ideaId = idea.body.trip.unscheduledItems[0].id as string;
    expect(idea.body.trip.summary.budget.totalEstimatedMinor).toBe(30000);
    expect(
      idea.body.trip.summary.warnings.map((warning: { code: string }) => warning.code),
    ).toContain("UNSCHEDULED_ITEMS");

    // An estimate without a charging basis is rejected.
    await request(server)
      .post(`/api/trips/${probeId}/items`)
      .set("Cookie", ownerCookie)
      .send({ title: "Missing basis", estimatedCostMinor: 9000 })
      .expect(400);

    const moved = await request(server)
      .patch(`/api/trips/${probeId}/items/${ideaId}/move`)
      .set("Cookie", ownerCookie)
      .send({ dayId: day2!.id })
      .expect(200);
    expect(moved.body.trip.unscheduledItems).toEqual([]);
    expect(moved.body.trip.days[1].items[0]).toMatchObject({ id: ideaId });

    // Timed items keep their clock time and move to the target day's date.
    const timed = await request(server)
      .post(`/api/trips/${probeId}/days/${day1!.id}/items`)
      .set("Cookie", ownerCookie)
      .send({
        title: "Accra walking tour",
        itemType: "TOUR",
        startTime: "09:00",
        endTime: "11:00",
        estimatedCostMinor: 20000,
        pricingBasis: "PER_GROUP",
      })
      .expect(201);
    const timedId = timed.body.trip.days[0].items[0].id as string;

    const movedTimed = await request(server)
      .patch(`/api/trips/${probeId}/items/${timedId}/move`)
      .set("Cookie", ownerCookie)
      .send({ dayId: day2!.id, position: 0 })
      .expect(200);
    const day2Items = movedTimed.body.trip.days[1].items as Array<{
      id: string;
      startTime: string | null;
    }>;
    expect(day2Items.map((item) => item.id)).toEqual([timedId, ideaId]);
    expect(day2Items[0]!.startTime).toBe("2026-12-02T09:00:00.000Z");

    expect(movedTimed.body.trip.summary.budget).toMatchObject({
      totalEstimatedMinor: 50000,
      perPersonEstimatedMinor: 25000,
      targetMinor: 100000,
      remainingMinor: 50000,
      overBudget: false,
      pricedItemCount: 2,
    });
    expect(
      movedTimed.body.trip.summary.warnings.map((warning: { code: string }) => warning.code),
    ).toContain("MISSING_ACCOMMODATION");

    // Move the idea back to the tray and reorder the two unscheduled ideas.
    await request(server)
      .patch(`/api/trips/${probeId}/items/${ideaId}/move`)
      .set("Cookie", ownerCookie)
      .send({ dayId: null })
      .expect(200);
    const secondIdea = await request(server)
      .post(`/api/trips/${probeId}/items`)
      .set("Cookie", ownerCookie)
      .send({ title: "Jamestown art walk", itemType: "NOTE" })
      .expect(201);
    const secondIdeaId = secondIdea.body.trip.unscheduledItems[1].id as string;

    const reordered = await request(server)
      .post(`/api/trips/${probeId}/items/reorder`)
      .set("Cookie", ownerCookie)
      .send({ itemIds: [secondIdeaId, ideaId] })
      .expect(201);
    expect(
      reordered.body.trip.unscheduledItems.map((item: { id: string }) => item.id),
    ).toEqual([secondIdeaId, ideaId]);

    // Unknown destination preferences are rejected; foreign moves stay 404.
    const badPreference = await request(server)
      .patch(`/api/trips/${probeId}`)
      .set("Cookie", ownerCookie)
      .send({ destinationPreferences: ["does-not-exist"] })
      .expect(400);
    expect(badPreference.body.error.code).toBe("DESTINATION_NOT_FOUND");

    await request(server)
      .patch(`/api/trips/${probeId}/items/${timedId}/move`)
      .set("Cookie", rivalCookie)
      .send({ dayId: day1!.id })
      .expect(404);

    await request(server)
      .delete(`/api/trips/${probeId}`)
      .set("Cookie", ownerCookie)
      .expect(200);
  });

  it("removes the traveler and deletes the trip", async () => {
    const server = app.getHttpServer();

    const removedTraveler = await request(server)
      .delete(`/api/trips/${tripId}/travelers/${travelerId}`)
      .set("Cookie", ownerCookie)
      .expect(200);
    expect(removedTraveler.body.trip.travelers).toEqual([]);

    await request(server).delete(`/api/trips/${tripId}`).set("Cookie", ownerCookie).expect(200);
    await request(server).get(`/api/trips/${tripId}`).set("Cookie", ownerCookie).expect(404);

    const list = await request(server).get("/api/trips").set("Cookie", ownerCookie).expect(200);
    expect(list.body.items).toEqual([]);
  });
});
