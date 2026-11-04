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
 * Postgres-backed integration test of the admin package CRUD:
 * ADMIN-only access, validation, destination references, publishing and
 * set-replacement of the day-by-day outline.
 */
const ADMIN = {
  name: "Ama Curator",
  email: "int-packages-admin@example.com",
  password: "correct-horse-battery",
};
const TRAVELER = {
  name: "Tess Traveler",
  email: "int-packages-traveler@example.com",
  password: "correct-horse-battery",
};

let app: NestExpressApplication;
let prisma: PrismaService;
let adminCookie = "";
let travelerCookie = "";
let destinationId = "";
let packageId = "";

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

  // Destination fixture independent of the seeded catalog.
  const region = await prisma.region.create({
    data: { slug: "int-packages-region", name: "Package Region" },
    select: { id: true },
  });
  const city = await prisma.city.create({
    data: {
      regionId: region.id,
      slug: "int-packages-city",
      name: "Package City",
      lat: 5.05,
      lng: -1.3,
    },
    select: { id: true },
  });
  const destination = await prisma.destination.create({
    data: {
      cityId: city.id,
      slug: "int-packages-destination",
      name: "Package Destination",
      category: "HISTORICAL",
      lat: 5.05,
      lng: -1.3,
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

describe("admin packages", () => {
  it("is ADMIN-only and requires a session", async () => {
    travelerCookie = await register(TRAVELER);
    adminCookie = await register(ADMIN);

    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: ADMIN.email },
      select: { id: true },
    });
    await prisma.roleMembership.create({
      data: { userId: admin.id, role: Role.ADMIN, status: "ACTIVE" },
    });

    await request(app.getHttpServer()).get("/api/admin/packages").expect(401);

    const forbidden = await request(app.getHttpServer())
      .get("/api/admin/packages")
      .set("Cookie", travelerCookie)
      .expect(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");

    const list = await request(app.getHttpServer())
      .get("/api/admin/packages")
      .set("Cookie", adminCookie)
      .expect(200);
    // The admin reads packages; never assert emptiness because other specs
    // share this database - assert the spec's own slug is absent for now.
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((p: { slug: string }) => p.slug === "cape-coast-heritage")).toBe(false);
  });

  it("validates payloads and rejects unknown destinations", async () => {
    const server = app.getHttpServer();

    const invalid = await request(server)
      .post("/api/admin/packages")
      .set("Cookie", adminCookie)
      .send({ title: "x", durationDays: 0, durationNights: 0, priceMinor: -1 })
      .expect(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    const badNights = await request(server)
      .post("/api/admin/packages")
      .set("Cookie", adminCookie)
      .send({
        title: "Too many nights",
        durationDays: 3,
        durationNights: 3,
        priceMinor: 100_000,
      })
      .expect(400);
    expect(badNights.body.error.code).toBe("VALIDATION_ERROR");

    const badDestination = await request(server)
      .post("/api/admin/packages")
      .set("Cookie", adminCookie)
      .send({
        title: "Unknown place",
        destinationId: "does-not-exist",
        durationDays: 2,
        durationNights: 1,
        priceMinor: 100_000,
      })
      .expect(400);
    expect(badDestination.body.error.code).toBe("INVALID_DESTINATION");
  });

  it("creates a draft with a generated slug and an ordered outline", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/admin/packages")
      .set("Cookie", adminCookie)
      .send({
        title: "Cape Coast Heritage",
        summary: "Forts and coastline",
        destinationId,
        durationDays: 3,
        durationNights: 2,
        priceMinor: 250_000,
        currencyCode: "GHS",
        inclusions: "2 nights\nBreakfast",
        days: [
          { dayNumber: 2, title: "Castle and coast", meals: "Breakfast" },
          { dayNumber: 1, title: "Arrive in Cape Coast" },
        ],
      })
      .expect(201);

    const pkg = res.body.package;
    packageId = pkg.id;

    expect(pkg).toMatchObject({
      slug: "cape-coast-heritage",
      status: "DRAFT",
      featured: false,
      durationDays: 3,
      durationNights: 2,
      priceMinor: 250_000,
      dayCount: 2,
      publishedAt: null,
      destination: {
        id: destinationId,
        name: "Package Destination",
        cityName: "Package City",
        regionName: "Package Region",
      },
    });
    expect(pkg.days.map((day: { dayNumber: number }) => day.dayNumber)).toEqual([1, 2]);

    // Drafts stay invisible on the public catalog.
    const publicDraftList = await request(app.getHttpServer())
      .get("/api/packages")
      .expect(200);
    expect(publicDraftList.body.items.some((pkg: { id: string }) => pkg.id === packageId)).toBe(false);

    await request(app.getHttpServer())
      .get("/api/packages/cape-coast-heritage")
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/admin/packages?q=heritage")
      .set("Cookie", adminCookie)
      .expect(200);
    const searched = list.body.items.find((p: { id: string }) => p.id === packageId);
    expect(searched).toBeTruthy();

    const publishedOnly = await request(app.getHttpServer())
      .get("/api/admin/packages?status=PUBLISHED")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(publishedOnly.body.items.some((p: { id: string }) => p.id === packageId)).toBe(false);
  });

  it("publishes, replaces the outline and validates merged durations", async () => {
    const server = app.getHttpServer();

    const updated = await request(server)
      .patch(`/api/admin/packages/${packageId}`)
      .set("Cookie", adminCookie)
      .send({
        status: "PUBLISHED",
        summary: "",
        days: [{ dayNumber: 1, title: "A single new day", accommodation: "Beach lodge" }],
      })
      .expect(200);

    expect(updated.body.package.status).toBe("PUBLISHED");
    expect(updated.body.package.publishedAt).toEqual(expect.any(String));
    expect(updated.body.package.summary).toBeNull();
    expect(updated.body.package.days).toHaveLength(1);
    expect(updated.body.package.days[0].title).toBe("A single new day");
    expect(updated.body.package.days[0].accommodation).toBe("Beach lodge");

    // Published packages appear on the public read surface.
    const publicList = await request(server).get("/api/packages").expect(200);
    const listed = publicList.body.items.find((p: { id: string }) => p.id === packageId);
    expect(listed).toBeTruthy();
    expect(listed.status).toBe("PUBLISHED");

    const publicDetail = await request(server)
      .get("/api/packages/cape-coast-heritage")
      .expect(200);
    expect(publicDetail.body.package.id).toBe(packageId);
    expect(publicDetail.body.package.days).toHaveLength(1);

    const merged = await request(server)
      .patch(`/api/admin/packages/${packageId}`)
      .set("Cookie", adminCookie)
      .send({ durationNights: 3 })
      .expect(400);
    expect(merged.body.error.code).toBe("INVALID_DURATION");

    const unpublished = await request(server)
      .patch(`/api/admin/packages/${packageId}`)
      .set("Cookie", adminCookie)
      .send({ status: "DRAFT" })
      .expect(200);
    expect(unpublished.body.package.publishedAt).toBeNull();

    // Unpublishing hides the package again.
    await request(server).get("/api/packages/cape-coast-heritage").expect(404);
    const publicAfterUnpublish = await request(server).get("/api/packages").expect(200);
    expect(
      publicAfterUnpublish.body.items.some((p: { id: string }) => p.id === packageId),
    ).toBe(false);
  });

  it("gets, deletes and then hides the package", async () => {
    const server = app.getHttpServer();

    const found = await request(server)
      .get(`/api/admin/packages/${packageId}`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(found.body.package.id).toBe(packageId);

    await request(server)
      .get("/api/admin/packages/does-not-exist")
      .set("Cookie", adminCookie)
      .expect(404);

    await request(server)
      .delete(`/api/admin/packages/${packageId}`)
      .set("Cookie", adminCookie)
      .expect(200);

    await request(server)
      .get(`/api/admin/packages/${packageId}`)
      .set("Cookie", adminCookie)
      .expect(404);

    await request(server)
      .delete(`/api/admin/packages/${packageId}`)
      .set("Cookie", adminCookie)
      .expect(404);
  });
});
