import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma.service";
import { MAILER, type Mailer } from "../src/modules/auth/mailer";

/**
 * Postgres-backed integration test of trip sharing (D19): token lifecycle
 * (create → rotate → revoke) and the sanitized public view — the response
 * must not carry budget figures, notes, planner data beyond the outline, or
 * anything needing an account.
 */
const OWNER = {
  name: "Peter Share",
  email: "int-share-owner@example.com",
  password: "correct-horse-battery",
};
const RIVAL = {
  name: "Rukaya Rival",
  email: "int-share-rival@example.com",
  password: "correct-horse-battery",
};

let app: NestExpressApplication;
let prisma: PrismaService;
let ownerCookie = "";
let rivalCookie = "";
let tripId = "";
let day1Id = "";
let destinationId = "";

beforeAll(async () => {
  const testMailer: Mailer = { async send() {} };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER)
    .useValue(testMailer)
    .compile();

  app = moduleRef.createNestApplication({ logger: ["error", "warn"] });
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  await app.init();

  prisma = moduleRef.get(PrismaService);

  ownerCookie = await register(OWNER);
  rivalCookie = await register(RIVAL);

  const region = await prisma.region.create({
    data: { slug: "int-share-region", name: "Share Region" },
    select: { id: true },
  });
  const city = await prisma.city.create({
    data: { regionId: region.id, slug: "int-share-city", name: "Share City", lat: 4.9, lng: -1.7 },
    select: { id: true },
  });
  const destination = await prisma.destination.create({
    data: {
      cityId: city.id,
      slug: "int-share-beach",
      name: "Share Cape",
      category: "BEACH",
      lat: 4.9,
      lng: -1.75,
      published: true,
    },
    select: { id: true },
  });
  destinationId = destination.id;

  const tripRes = await request(app.getHttpServer())
    .post("/api/trips")
    .set("Cookie", ownerCookie)
    .send({
      name: "Sunset trip",
      startDate: "2026-11-01",
      endDate: "2026-11-02",
      adults: 2,
      children: 1,
      budgetMinor: 300_000,
      currencyCode: "GHS",
      notes: "PRIVATE: airport pickup booked with cousin Kojo",
      interests: ["BEACHES_COASTAL"],
    })
    .expect(201);
  tripId = tripRes.body.trip.id;
  day1Id = tripRes.body.trip.days[0]!.id;

  const itemRes = await request(app.getHttpServer())
    .post(`/api/trips/${tripId}/days/${day1Id}/items`)
    .set("Cookie", ownerCookie)
    .send({
      title: "Beach afternoon",
      itemType: "RESTAURANT",
      startTime: "13:00",
      endTime: "15:00",
      destinationId,
      notes: "PRIVATE: ask for the back table",
      estimatedCostMinor: 12_000,
      pricingBasis: "PER_GROUP",
      estimateSource: "MANUAL",
    })
    .expect(201);

  await request(app.getHttpServer())
    .post(`/api/trips/${tripId}/items`)
    .set("Cookie", ownerCookie)
    .send({ title: "Idea: surf lesson", itemType: "EXPERIENCE" })
    .expect(201);

  // Sanity for assertions below.
  expect(itemRes.body.trip.days[0]!.items[0]!.notes).toBe("PRIVATE: ask for the back table");
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

describe("share tokens", () => {
  it("are owner-only operations", async () => {
    await request(app.getHttpServer()).post(`/api/trips/${tripId}/share`).expect(401);

    await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/share`)
      .set("Cookie", rivalCookie)
      .expect(404);

    const status = await request(app.getHttpServer())
      .get(`/api/trips/${tripId}/share`)
      .set("Cookie", rivalCookie)
      .expect(404);
    expect(status.body.error.code).toBe("TRIP_NOT_FOUND");
  });

  it("create → rotate → revoke, with old tokens failing closed", async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/share`)
      .set("Cookie", ownerCookie)
      .expect(201);
    const firstPath = first.body.share.path as string;
    expect(firstPath).toMatch(/^\/share\/[A-Za-z0-9_-]{16,64}$/);
    const firstToken = firstPath.slice("/share/".length);

    // The owner panel sees the same active link.
    const status = await request(app.getHttpServer())
      .get(`/api/trips/${tripId}/share`)
      .set("Cookie", ownerCookie)
      .expect(200);
    expect(status.body.share).toEqual({ active: true, path: firstPath });

    // Rotation must kill the previous token.
    const rotated = await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/share`)
      .set("Cookie", ownerCookie)
      .expect(201);
    const secondPath = rotated.body.share.path as string;
    expect(secondPath).not.toBe(firstPath);

    await request(app.getHttpServer()).get(`/api/trips/share/${firstToken}`).expect(404);

    const shared = await request(app.getHttpServer())
      .get(`/api/trips/share/${secondPath.slice("/share/".length)}`)
      .expect(200); // deliberately no credentials

    const view = shared.body.share;
    expect(view.name).toBe("Sunset trip");
    expect(view.startDate).toBe("2026-11-01");
    expect(view.endDate).toBe("2026-11-02");
    expect(view.adults).toBe(2);
    expect(view.children).toBe(1);
    expect(view.interests).toEqual(["BEACHES_COASTAL"]);
    expect(view.days).toHaveLength(2);
    const item = view.days[0].items[0];
    expect(item.title).toBe("Beach afternoon");
    expect(item.startTime).toBe("13:00");
    expect(item.endTime).toBe("15:00");
    expect(item.placeName).toBe("Share Cape");
    expect(view.unscheduledTitles).toEqual(["Idea: surf lesson"]);

    const raw = JSON.stringify(shared.body);
    for (const forbidden of [
      "PRIVATE",
      "airport pickup",
      "back table",
      "3000",
      "budgetMinor",
      "estimated",
      "travelers",
      "needs",
    ]) {
      expect(raw).not.toContain(forbidden);
    }

    // Revoke: the link stops resolving for everyone.
    await request(app.getHttpServer())
      .delete(`/api/trips/${tripId}/share`)
      .set("Cookie", ownerCookie)
      .expect(200);
    expect((await request(app.getHttpServer()).get(`/api/trips/share/${secondPath.slice("/share/".length)}`)).status).toBe(404);

    const idle = await request(app.getHttpServer())
      .get(`/api/trips/${tripId}/share`)
      .set("Cookie", ownerCookie)
      .expect(200);
    expect(idle.body.share).toEqual({ active: false, path: null });
  });

  it("404s unknown tokens with the stable share code", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/trips/share/nonexistentsharetoken123456")
      .expect(404);
    expect(res.body.error.code).toBe("SHARE_NOT_FOUND");
  });
});
