import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma.service";
import { MAILER, type Mailer } from "../src/modules/auth/mailer";

/**
 * Postgres-backed integration test of the catalog admin (D20 Phase 6):
 * destination/attraction CRUD with slugs, publish/unpublish reflected in the
 * public catalog, reference-count delete guards, and audit rows.
 */
const ADMIN = {
  name: "Kofi Curator",
  email: "int-cat-admin@example.com",
  password: "correct-horse-battery",
};
const RIVAL = {
  name: "Abena Reader",
  email: "int-cat-rival@example.com",
  password: "correct-horse-battery",
};

let app: NestExpressApplication;
let prisma: PrismaService;
let adminCookie = "";
let cityId = "";

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

  adminCookie = await register(ADMIN);
  rivalSession = await register(RIVAL);

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: ADMIN.email },
    select: { id: true },
  });
  await prisma.roleMembership.create({
    data: { userId: admin.id, role: "ADMIN", status: "ACTIVE" } as never,
  });

  const region = await prisma.region.create({
    data: { slug: "int-cat-region", name: "Catalog Test Region" },
    select: { id: true },
  });
  const city = await prisma.city.create({
    data: { regionId: region.id, slug: "int-cat-city", name: "Catalog Test City", lat: 5.2, lng: -1.1 },
    select: { id: true },
  });
  cityId = city.id;
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

async function register(user: {
  name: string;
  email: string;
  password: string;
}): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/auth/register")
    .send(user)
    .expect(201);
  return sessionCookie(res);
}

const admin = () => request(app.getHttpServer());

let rivalSession = "";

describe("RBAC: catalog admin is ADMIN-only", () => {
  it("401 anon / 403 a non-admin", async () => {
    await admin().get("/api/admin/catalog/cities").expect(401);
    await admin().get("/api/admin/catalog/cities").set("Cookie", rivalSession).expect(403);
    await admin()
      .post("/api/admin/catalog/destinations")
      .set("Cookie", rivalSession)
      .send({ cityId, name: "Nope Castle", category: "HISTORICAL", lat: 5, lng: -1 })
      .expect(403);
  });

  it("cities selector works for the admin", async () => {
    const res = await admin()
      .get("/api/admin/catalog/cities")
      .set("Cookie", adminCookie)
      .expect(200);
    // The shared test DB may seed cities from other specs at runtime; assert
    // this spec's city is present with its region resolved.
    expect(res.body.items).toContainEqual(
      expect.objectContaining({
        id: cityId,
        name: "Catalog Test City",
        regionName: "Catalog Test Region",
      }),
    );
  });
});

describe("destinations CRUD", () => {
  it("creates with a derived slug and explicit slug", async () => {
    const created = await admin()
      .post("/api/admin/catalog/destinations")
      .set("Cookie", adminCookie)
      .send({
        cityId,
        name: "Int Cat Cape Coast",
        category: "HISTORICAL",
        lat: 5.1,
        lng: -1.24,
        published: true,
      })
      .expect(201);
    expect(created.body.item.slug).toBe("int-cat-cape-coast");
    expect(created.body.item.published).toBe(true);

    await admin()
      .post("/api/admin/catalog/destinations")
      .set("Cookie", adminCookie)
      .send({
        cityId,
        name: "Int Cat Hidden Grove",
        slug: "int-cat-hidden-grove",
        category: "NATURE",
        lat: 5.3,
        lng: -1.2,
        summary: "Not published yet",
      })
      .expect(201);
  });

  it("declines duplicate and invalid slugs", async () => {
    const dup = await admin()
      .post("/api/admin/catalog/destinations")
      .set("Cookie", adminCookie)
      .send({
        cityId,
        name: "Another Name Altogether",
        slug: "int-cat-cape-coast",
        category: "BEACH",
        lat: 4.9,
        lng: -1.7,
      })
      .expect(409);
    expect(dup.body.error.code).toBe("DUPLICATE_SLUG");

    await admin()
      .post("/api/admin/catalog/destinations")
      .set("Cookie", adminCookie)
      .send({
        cityId,
        name: "Bad Slug",
        slug: "Not A Slug",
        category: "BEACH",
        lat: 4.9,
        lng: -1.7,
      })
      .expect(400);
  });

  it("lists with search + published filter, and public routes only show published", async () => {
    const adminList = await admin()
      .get("/api/admin/catalog/destinations")
      .query({ q: "Int Cat" })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(adminList.body.total).toBe(2);

    const drafts = await admin()
      .get("/api/admin/catalog/destinations")
      .query({ published: "false" })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(drafts.body.items.map((item: { slug: string }) => item.slug)).toEqual([
      "int-cat-hidden-grove",
    ]);

    const hiddenPublic = await admin()
      .get("/api/destinations")
      .query({ q: "Int Cat Hidden Grove" })
      .expect(200);
    expect(hiddenPublic.body.items).toHaveLength(0);

    const visiblePublic = await admin()
      .get("/api/destinations")
      .query({ q: "Int Cat Cape Coast" })
      .expect(200);
    expect(visiblePublic.body.items).toHaveLength(1);
    expect(visiblePublic.body.items[0].slug).toBe("int-cat-cape-coast");
  });

  it("returns refCounts on the detail route", async () => {
    const list = await admin()
      .get("/api/admin/catalog/destinations")
      .query({ q: "Int Cat Cape Coast" })
      .set("Cookie", adminCookie)
      .expect(200);
    const id = list.body.items[0].id;

    const detail = await admin()
      .get(`/api/admin/catalog/destinations/${id}`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(detail.body.item.refCounts).toEqual({
      packages: 0,
      itineraryItems: 0,
      attractions: 0,
    });
  });

  it("updates fields and enforces slug uniqueness on change", async () => {
    const list = await admin()
      .get("/api/admin/catalog/destinations")
      .query({ q: "Int Cat Cape Coast" })
      .set("Cookie", adminCookie)
      .expect(200);
    const id = list.body.items[0].id;

    const updated = await admin()
      .patch(`/api/admin/catalog/destinations/${id}`)
      .set("Cookie", adminCookie)
      .send({ summary: "Unakite cliffs above the sea" })
      .expect(200);
    expect(updated.body.item.summary).toBe("Unakite cliffs above the sea");

    await admin()
      .patch(`/api/admin/catalog/destinations/${id}`)
      .set("Cookie", adminCookie)
      .send({ slug: "int-cat-hidden-grove" })
      .expect(409);
  });
});

describe("attractions CRUD + publish filter", () => {
  let destinationId = "";
  let attractionId = "";

  it("creates attached/unattached attractions", async () => {
    const list = await admin()
      .get("/api/admin/catalog/destinations")
      .query({ q: "Int Cat Cape Coast" })
      .set("Cookie", adminCookie)
      .expect(200);
    destinationId = list.body.items[0].id;

    const created = await admin()
      .post("/api/admin/catalog/attractions")
      .set("Cookie", adminCookie)
      .send({
        destinationId,
        name: "Int Cat Sky Walk",
        lat: 5.35,
        lng: -1.39,
      })
      .expect(201);
    attractionId = created.body.item.id;
    expect(created.body.item.slug).toBe("int-cat-sky-walk");
    // Attraction publish defaults to true (the model default), destinations
    // default to false — a destination is an editorial page, an attraction
    // is a point of interest.
    expect(created.body.item.published).toBe(true);

    const orphan = await admin()
      .post("/api/admin/catalog/attractions")
      .set("Cookie", adminCookie)
      .send({
        name: "Int Cat Loose Cannon",
        lat: 5.4,
        lng: -1.4,
        cityId,
        published: false,
      })
      .expect(201);
    expect(orphan.body.item.destinationId).toBeNull();
  });

  it("hides unpublished attraction from public catalog, shows when published", async () => {
    const visible = await admin()
      .get("/api/catalog/attractions")
      .query({ q: "Int Cat Sky Walk" })
      .expect(200);
    expect(visible.body.items).toHaveLength(1);

    await admin()
      .patch(`/api/admin/catalog/attractions/${attractionId}`)
      .set("Cookie", adminCookie)
      .send({ published: false })
      .expect(200);

    const hidden = await admin()
      .get("/api/catalog/attractions")
      .query({ q: "Int Cat Sky Walk" })
      .expect(200);
    expect(hidden.body.items).toHaveLength(0);

    // Admin list filtered to unpublished contains it.
    const drafts = await admin()
      .get("/api/admin/catalog/attractions")
      .query({ published: "false" })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(
      drafts.body.items.some((item: { id: string }) => item.id === attractionId),
    ).toBe(true);

    // Publish again for the delete-guard block below.
    await admin()
      .patch(`/api/admin/catalog/attractions/${attractionId}`)
      .set("Cookie", adminCookie)
      .send({ published: true })
      .expect(200);
  });

  it("guards attraction delete while a trip references it, then deletes", async () => {
    const trip = await admin()
      .post("/api/trips")
      .set("Cookie", adminCookie)
      .send({ name: "Catalog Guard Trip" })
      .expect(201);

    await admin()
      .post(`/api/trips/${trip.body.trip.id}/items`)
      .set("Cookie", adminCookie)
      .send({ title: "Canopy walk", attractionId })
      .expect(201);

    const blocked = await admin()
      .delete(`/api/admin/catalog/attractions/${attractionId}`)
      .set("Cookie", adminCookie)
      .expect(409);
    expect(blocked.body.error.code).toBe("REFERENCED_BY_TRIPS");
    expect(blocked.body.error.message).toContain("itinerary item");

    // Remove the reference so the attraction can be deleted again.
    const refreshed = await admin()
      .get(`/api/trips/${trip.body.trip.id}`)
      .set("Cookie", adminCookie)
      .expect(200);
    const item = (refreshed.body.trip.unscheduledItems as Array<{
      id: string;
      title: string;
    }>).find((entry) => entry.title === "Canopy walk");
    expect(item, "trip item should exist").toBeTruthy();
    await admin()
      .delete(`/api/trips/${trip.body.trip.id}/items/${item!.id}`)
      .set("Cookie", adminCookie)
      .expect(200);

    // Destination delete is blocked while the (again-linked) attraction references it.
    const detail = (await admin()
      .get(`/api/admin/catalog/attractions/${attractionId}`)
      .set("Cookie", adminCookie)
      .expect(200)).body.item;
    if (!detail.refCounts || detail.refCounts.itineraryItems !== 0) {
      throw new Error("expected zero itinerary references after removal");
    }

    const destBlocked = await admin()
      .delete(`/api/admin/catalog/destinations/${destinationId}`)
      .set("Cookie", adminCookie)
      .expect(409);
    expect(destBlocked.body.error.code).toBe("REFERENCED_BY_CONTENT");
    expect(destBlocked.body.error.message).toContain("unpublish");

    // Detach, then both deletes succeed.
    await admin()
      .patch(`/api/admin/catalog/attractions/${attractionId}`)
      .set("Cookie", adminCookie)
      .send({ destinationId: null })
      .expect(200);
    await admin()
      .delete(`/api/admin/catalog/attractions/${attractionId}`)
      .set("Cookie", adminCookie)
      .expect(200);
    await admin()
      .delete(`/api/admin/catalog/destinations/${destinationId}`)
      .set("Cookie", adminCookie)
      .expect(200);
  });
});

describe("audit trail records catalog mutations", () => {
  it("exposes created/updated/deleted actions", async () => {
    const res = await admin()
      .get("/api/admin/audit")
      .query({ action: "destination" })
      .set("Cookie", adminCookie)
      .expect(200);
    const actions = new Set(
      res.body.items.map((row: { action: string }) => row.action),
    );
    expect(actions.has("DESTINATION_CREATED")).toBe(true);
    expect(actions.has("DESTINATION_UPDATED")).toBe(true);
    expect(actions.has("DESTINATION_DELETED")).toBe(true);
  });
});
