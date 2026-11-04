import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Role } from "@travelghana/database";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma.service";
import { MAILER, type Mailer } from "../src/modules/auth/mailer";

/**
 * Postgres-backed integration test of the concierge loop (D6):
 * public capture with/without a session, trip-linked enrichment only from an
 * owned trip, and the ADMIN queue pipeline.
 */
const OWNER = {
  name: "Osei Planner",
  email: "int-enq-owner@example.com",
  password: "correct-horse-battery",
};
const RIVAL = {
  name: "Rashida Rival",
  email: "int-enq-rival@example.com",
  password: "correct-horse-battery",
};
const ADMIN = {
  name: "Kwesi Concierge",
  email: "int-enq-admin@example.com",
  password: "correct-horse-battery",
};

let app: NestExpressApplication;
let prisma: PrismaService;
let ownerCookie = "";
let rivalCookie = "";
let adminCookie = "";
let tripId = "";

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
  adminCookie = await register(ADMIN);
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: ADMIN.email },
    select: { id: true },
  });
  await prisma.roleMembership.create({
    data: { userId: admin.id, role: Role.ADMIN, status: "ACTIVE" },
  });

  // A destination name the trip-linked enquiry should snapshot.
  const region = await prisma.region.create({
    data: { slug: "int-enq-region", name: "Enquiry Region" },
    select: { id: true },
  });
  const city = await prisma.city.create({
    data: { regionId: region.id, slug: "int-enq-city", name: "Enquiry City", lat: 5.1, lng: -1.2 },
    select: { id: true },
  });
  const destination = await prisma.destination.create({
    data: {
      cityId: city.id,
      slug: "int-enq-kakum",
      name: "Enquiry Kakum",
      category: "NATURE",
      lat: 5.35,
      lng: -1.39,
      published: true,
    },
    select: { id: true },
  });

  const tripRes = await request(app.getHttpServer())
    .post("/api/trips")
    .set("Cookie", ownerCookie)
    .send({
      name: "Coast week",
      startDate: "2026-12-01",
      endDate: "2026-12-04",
      adults: 2,
      children: 1,
      budgetMinor: 400_000,
      currencyCode: "GHS",
      destinationPreferences: [destination.id],
      interests: ["BEACHES_COASTAL", "FOOD_CUISINE"],
    })
    .expect(201);
  tripId = tripRes.body.trip.id;
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

describe("public enquiry capture", () => {
  it("accepts a guest brief and returns an ENQ- code", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/enquiries")
      .send({
        name: "Efua Guest",
        email: "efua.guest@example.com",
        startDate: "2027-01-10",
        endDate: "2027-01-14",
        adults: 2,
        destinations: ["Kakum National Park"],
        budgetRange: "GHS 5,000 - 10,000",
        specialRequests: "Honeymoon, quiet beaches",
      })
      .expect(201);

    const enquiry = res.body.enquiry;
    expect(enquiry.code).toMatch(/^ENQ-[A-HJ-NP-Z2-9]{6}$/);
    expect(enquiry.status).toBe("NEW");
    expect(enquiry.tripId).toBeNull();
    expect(enquiry.destinations).toEqual(["Kakum National Park"]);
    expect(enquiry.specialRequests).toBe("Honeymoon, quiet beaches");
  });

  it("validates the payload (bad email, empty body)", async () => {
    const noFields = await request(app.getHttpServer()).post("/api/enquiries").send({}).expect(400);
    expect(noFields.body.error.code).toBe("MISSING_CONTACT");

    const badEmail = await request(app.getHttpServer())
      .post("/api/enquiries")
      .send({ name: "Someone", email: "not-an-email" })
      .expect(400);
    expect(badEmail.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses to link a trip for guests", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/enquiries")
      .send({ tripId, name: "No Session", email: "guest@example.com" })
      .expect(401);
    expect(res.body.error.message).toContain("Sign in");
  });

  it("enriches trip-linked enquiries from the owner's trip only, rejecting rivals", async () => {
    const rivalRes = await request(app.getHttpServer())
      .post("/api/enquiries")
      .set("Cookie", rivalCookie)
      .send({ tripId })
      .expect(404);
    expect(rivalRes.body.error.code).toBe("TRIP_NOT_FOUND");

    const res = await request(app.getHttpServer())
      .post("/api/enquiries")
      .set("Cookie", ownerCookie)
      .send({ tripId })
      .expect(201);

    const enquiry = res.body.enquiry;
    expect(enquiry.tripId).toBe(tripId);
    expect(enquiry.destinations).toEqual(["Enquiry Kakum"]);
    expect(enquiry.interests).toEqual(["BEACHES_COASTAL", "FOOD_CUISINE"]);
    expect(enquiry.startDate).toBe("2026-12-01");
    expect(enquiry.endDate).toBe("2026-12-04");
    expect(enquiry.adults).toBe(2);
    expect(enquiry.children).toBe(1);
    expect(enquiry.budgetRange).toBe("GHS 4,000 per group");
    expect(enquiry.name).toBe(OWNER.name); // defaulted from the account
  });
});

describe("admin concierge queue", () => {
  it("requires ADMIN", async () => {
    await request(app.getHttpServer()).get("/api/admin/enquiries").expect(401);

    await request(app.getHttpServer())
      .get("/api/admin/enquiries")
      .set("Cookie", rivalCookie)
      .expect(403);
  });

  it("searches, then advances the pipeline one honest step at a time", async () => {
    const list = await request(app.getHttpServer())
      .get("/api/admin/enquiries")
      .set("Cookie", adminCookie)
      .query({ q: "Efua Guest" })
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    const enquiry = list.body.items[0];
    expect(enquiry.email).toBe("efua.guest@example.com");

    // NEW → CONVERTED skips the human review the pipeline promises.
    const skip = await request(app.getHttpServer())
      .patch(`/api/admin/enquiries/${enquiry.id}`)
      .set("Cookie", adminCookie)
      .send({ status: "CONVERTED" })
      .expect(400);
    expect(skip.body.error.code).toBe("INVALID_STATUS_TRANSITION");

    const assign = await request(app.getHttpServer())
      .patch(`/api/admin/enquiries/${enquiry.id}`)
      .set("Cookie", adminCookie)
      .send({ assignedAdminId: null })
      .expect(200);
    expect(assign.body.enquiry.assignedAdminId).toBeNull();

    const advanced = await request(app.getHttpServer())
      .patch(`/api/admin/enquiries/${enquiry.id}`)
      .set("Cookie", adminCookie)
      .send({ status: "IN_REVIEW" })
      .expect(200);
    expect(advanced.body.enquiry.status).toBe("IN_REVIEW");

    const filtered = await request(app.getHttpServer())
      .get("/api/admin/enquiries")
      .set("Cookie", adminCookie)
      .query({ status: "IN_REVIEW" })
      .expect(200);
    expect(filtered.body.items.map((row: { code: string }) => row.code)).toContain(
      advanced.body.enquiry.code,
    );
  });
});

describe("admin cleanup deletes (D28)", () => {
  it("requires ADMIN", async () => {
    await request(app.getHttpServer()).delete("/api/admin/enquiries/enq-none").expect(401);
    await request(app.getHttpServer())
      .delete("/api/admin/enquiries/enq-none")
      .set("Cookie", rivalCookie)
      .expect(403);
    await request(app.getHttpServer()).delete("/api/admin/notifications/ntf-none").expect(401);
    await request(app.getHttpServer())
      .delete("/api/admin/notifications/ntf-none")
      .set("Cookie", rivalCookie)
      .expect(403);
  });

  it("deletes an enquiry, leaves the audit reference, and 404s the second time", async () => {
    const list = await request(app.getHttpServer())
      .get("/api/admin/enquiries")
      .set("Cookie", adminCookie)
      .query({ q: "Efua Guest" })
      .expect(200);
    const enquiry = list.body.items[0];
    expect(enquiry, "the guest enquiry should exist").toBeDefined();

    const del = await request(app.getHttpServer())
      .delete(`/api/admin/enquiries/${enquiry.id}`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(del.body.message).toContain(enquiry.code);

    const gone = await request(app.getHttpServer())
      .get("/api/admin/enquiries")
      .set("Cookie", adminCookie)
      .query({ q: enquiry.code })
      .expect(200);
    expect(gone.body.items.some((row: { id: string }) => row.id === enquiry.id)).toBe(false);

    const again = await request(app.getHttpServer())
      .delete(`/api/admin/enquiries/${enquiry.id}`)
      .set("Cookie", adminCookie)
      .expect(404);
    expect(again.body.error.code).toBe("ENQUIRY_NOT_FOUND");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "ENQUIRY_DELETED", entityId: enquiry.id },
    });
    expect(audit).not.toBeNull();
    expect(audit!.meta).toMatchObject({ code: enquiry.code, email: enquiry.email });
  });

  it("deletes a queued outbox record but 404s the second time", async () => {
    const list = await request(app.getHttpServer())
      .get("/api/admin/notifications")
      .set("Cookie", adminCookie)
      .query({ type: "ENQUIRY_RECEIVED" })
      .expect(200);
    const queued = list.body.items.find(
      (row: { status: string }) => row.status === "QUEUED",
    ) as { id: string } | undefined;
    expect(queued, "a queued enquiry notification should exist").toBeDefined();

    const del = await request(app.getHttpServer())
      .delete(`/api/admin/notifications/${queued!.id}`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(del.body.message).toContain("deleted");

    const again = await request(app.getHttpServer())
      .delete(`/api/admin/notifications/${queued!.id}`)
      .set("Cookie", adminCookie)
      .expect(404);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "NOTIFICATION_DELETED", entityId: queued!.id },
    });
    expect(audit).not.toBeNull();
    expect(again).toBeDefined();
  });
});
