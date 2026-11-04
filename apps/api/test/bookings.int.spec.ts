import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Role } from "@travelghana/database";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma.service";
import { MAILER, type Mailer, type MailMessage } from "../src/modules/auth/mailer";

/**
 * Postgres-backed integration test of package bookings (D25):
 * login-first (anonymous 401), drafts/unknown packages 404, the created
 * request lands in the ADMIN queue with package + user context, and each
 * request is audited.
 */
const ADMIN = {
  name: "Besi Bookkeeper",
  email: "int-bookings-admin@example.com",
  password: "correct-horse-battery",
};
const TRAVELER = {
  name: "Tayo Traveler",
  email: "int-bookings-traveler@example.com",
  password: "correct-horse-battery",
};

let app: NestExpressApplication;
let prisma: PrismaService;
let travelerCookie = "";
let adminCookie = "";
let packageId = "";
let createdCode = "";
let sentEmails: MailMessage[] = [];

beforeAll(async () => {
  sentEmails = [];
  const testMailer: Mailer = {
    async send(message) {
      sentEmails.push(message);
    },
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER)
    .useValue(testMailer)
    .compile();

  app = moduleRef.createNestApplication({ logger: ["error", "warn"] });
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  await app.init();

  prisma = moduleRef.get(PrismaService);

  // Package fixtures independent of the seeded catalog.
  const region = await prisma.region.create({ data: { slug: "int-bookings-region", name: "Bookings Region" }, select: { id: true } });
  const city = await prisma.city.create({
    data: { regionId: region.id, slug: "int-bookings-city", name: "Bookings City", lat: 5.6, lng: -0.2 },
    select: { id: true },
  });
  const destination = await prisma.destination.create({
    data: { cityId: city.id, slug: "int-bookings-destination", name: "Bookings Destination", category: "HISTORICAL", lat: 5.6, lng: -0.2, published: true },
    select: { id: true },
  });
  const published = await prisma.package.create({
    data: {
      slug: "int-bookings-published",
      title: "Bookable Journey",
      destinationId: destination.id,
      durationDays: 4,
      durationNights: 3,
      priceMinor: 380000,
      status: "PUBLISHED",
    },
    select: { id: true },
  });
  await prisma.package.create({
    data: {
      slug: "int-bookings-draft",
      title: "Unfinished Journey",
      destinationId: destination.id,
      durationDays: 2,
      durationNights: 1,
      priceMinor: 120000,
      status: "DRAFT",
    },
    select: { id: true },
  });
  packageId = published.id;
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

describe("package bookings", () => {
  it("requires a signed-in traveler before anything else", async () => {
    travelerCookie = await register(TRAVELER);
    adminCookie = await register(ADMIN);

    // Anonymous request: the session guard rejects even a valid-shaped body.
    await request(app.getHttpServer())
      .post("/api/bookings")
      .send({ packageId, startDate: "2027-02-01", adults: 2, children: 0 })
      .expect(401);

    // Elevation: ADMIN-only queue.
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN.email }, select: { id: true } });
    await prisma.roleMembership.create({ data: { userId: adminUser.id, role: Role.ADMIN, status: "ACTIVE" } });

    await request(app.getHttpServer()).post("/api/bookings")
      .set("Cookie", adminCookie)
      .send({ packageId: "does-not-exist-000000000", startDate: "2027-02-01", adults: 1, children: 0 })
      .expect(404);
  });

  it("validates payloads", async () => {
    const server = app.getHttpServer();
    const invalid = await request(server)
      .post("/api/bookings")
      .set("Cookie", travelerCookie)
      .send({ packageId: packageId, startDate: "01/14/2029", adults: 99, children: 0 })
      .expect(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    const past = await request(server)
      .post("/api/bookings")
      .set("Cookie", travelerCookie)
      .send({ packageId, startDate: "2020-01-01", adults: 2, children: 0 })
      .expect(400);
    expect(past.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses draft packages but books a published one, and audits it", async () => {
    const server = app.getHttpServer();

    // Find the draft package id.
    const draft = await prisma.package.findUniqueOrThrow({ where: { slug: "int-bookings-draft" }, select: { id: true } });
    await request(server).post("/api/bookings").set("Cookie", travelerCookie)
      .send({ packageId: draft.id, startDate: "2027-02-01", adults: 2, children: 0 })
      .expect(404);

    const created = await request(server).post("/api/bookings")
      .set("Cookie", travelerCookie)
      .send({ packageId, startDate: "2027-02-01", adults: 2, children: 1, notes: "Two window seats please" })
      .expect(201);
    expect(created.body.booking.code).toMatch(/^PB-[A-Z2-9]{6}$/);
    expect(created.body.booking.status).toBe("PENDING_PAYMENT");
    expect(created.body.booking.adults).toBe(2);
    createdCode = created.body.booking.code;

    // Traveler does not see the admin queue.
    await request(app.getHttpServer()).get("/api/admin/bookings")
      .set("Cookie", travelerCookie)
      .expect(403);

    const queue = await request(app.getHttpServer()).get("/api/admin/bookings")
      .set("Cookie", adminCookie)
      .expect(200);

    expect(queue.body.items.some((item: { code: string }) => item.code === created.body.booking.code)).toBe(true);
    const mine = queue.body.items.find((item: { code: string }) => item.code === created.body.booking.code);
    expect(mine.package.slug).toBe("int-bookings-published");
    expect(mine.user.email).toBe(TRAVELER.email);

    // Status filter excludes unrelated statuses.
    const filtered = await request(app.getHttpServer()).get("/api/admin/bookings?status=COMPLETED")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(filtered.body.items.some((item: { code: string }) => item.code === created.body.booking.code)).toBe(false);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "PackageBooking", action: "PACKAGE_BOOKING_REQUESTED" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.action).toBe("PACKAGE_BOOKING_REQUESTED");
    expect(audit?.actorUserId).toBeTruthy();
  });

  it("lists only the traveler's own bookings on /me and emails a confirmation", async () => {
    const server = app.getHttpServer();

    // Session-scoped: anonymous callers get nothing back.
    await request(server).get("/api/bookings/me").expect(401);

    const mine = await request(server).get("/api/bookings/me")
      .set("Cookie", travelerCookie)
      .expect(200);
    expect(mine.body.total).toBeGreaterThanOrEqual(1);
    const mineRow = mine.body.items.find((item: { code: string }) => item.code === createdCode);
    expect(mineRow).toBeTruthy();
    expect(mineRow.package.slug).toBe("int-bookings-published");
    expect(mineRow.package.currencyCode).toBe("GHS");

    // Another account's /me does not include the traveler's booking.
    const adminMine = await request(server).get("/api/bookings/me")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(adminMine.body.items.some((item: { code: string }) => item.code === createdCode)).toBe(false);

    // The confirmation email was captured by the test harness mailer.
    const confirmation = sentEmails.find(
      (message) => message.to === TRAVELER.email && message.subject.includes(createdCode),
    );
    expect(confirmation, "expected a booking confirmation email for the traveler").toBeTruthy();
    expect(confirmation?.text).toContain("no payment has been taken");
    expect(confirmation?.text).toContain("Party: 2 adults, 1 child");

    // D27: the badge counts surface the member's own numbers.
    const counts = await request(server).get("/api/users/counts")
      .set("Cookie", travelerCookie)
      .expect(200);
    expect(counts.body.counts.packageBookings).toBeGreaterThanOrEqual(1);
    expect(counts.body.counts.trips).toBeGreaterThanOrEqual(0);
    await request(server).get("/api/users/counts").expect(401);
  });

  it("lets an admin clean up a junk request, then 404s the second delete (D28)", async () => {
    const server = app.getHttpServer();

    // Only admins may delete.
    await request(server).delete("/api/admin/bookings/none").expect(401);
    await request(server)
      .delete("/api/admin/bookings/none")
      .set("Cookie", travelerCookie)
      .expect(403);

    const queue = await request(server).get("/api/admin/bookings")
      .set("Cookie", adminCookie)
      .expect(200);
    const target = queue.body.items.find((item: { code: string }) => item.code === createdCode) as
      | { id: string; status: string }
      | undefined;
    expect(target, "the created booking should be in the admin queue").toBeDefined();
    expect(target!.status).toBe("PENDING_PAYMENT");

    const beforeCounts = await request(server).get("/api/users/counts")
      .set("Cookie", travelerCookie)
      .expect(200);

    const del = await request(server)
      .delete(`/api/admin/bookings/${target!.id}`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(del.body.message).toContain(createdCode);

    // The traveler no longer sees it on /me, and the badge count drops by one.
    const mine = await request(server).get("/api/bookings/me")
      .set("Cookie", travelerCookie)
      .expect(200);
    expect(mine.body.items.some((item: { code: string }) => item.code === createdCode)).toBe(false);

    const afterCounts = await request(server).get("/api/users/counts")
      .set("Cookie", travelerCookie)
      .expect(200);
    expect(afterCounts.body.counts.packageBookings).toBe(beforeCounts.body.counts.packageBookings - 1);

    // Unknown / already-deleted bookings 404.
    const again = await request(server)
      .delete(`/api/admin/bookings/${target!.id}`)
      .set("Cookie", adminCookie)
      .expect(404);
    expect(again.body.error.code).toBe("BOOKING_NOT_FOUND");

    // Financial-record guard: a CONFIRMED row is refused outright.
    const confirmed = await prisma.packageBooking.create({
      data: {
        code: `PB-TEST01`,
        userId: (await prisma.user.findUniqueOrThrow({ where: { email: TRAVELER.email }, select: { id: true } })).id,
        packageId,
        status: "CONFIRMED",
        startDate: new Date("2027-03-01T00:00:00.000Z"),
        adults: 1,
        children: 0,
      },
    });
    const refuse = await request(server)
      .delete(`/api/admin/bookings/${confirmed.id}`)
      .set("Cookie", adminCookie)
      .expect(409);
    expect(refuse.body.error.code).toBe("FINANCIAL_RECORD_IMMUTABLE");
    await prisma.packageBooking.delete({ where: { id: confirmed.id } });

    const audit = await prisma.auditLog.findFirst({
      where: { action: "PACKAGE_BOOKING_DELETED", entityId: target!.id },
    });
    expect(audit).not.toBeNull();
    expect(audit!.meta).toMatchObject({ code: createdCode, packageTitle: expect.any(String) });
  });
});
