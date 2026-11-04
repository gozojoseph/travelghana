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
 * Postgres-backed integration test of the admin gallery CRUD:
 * ADMIN-only access, validation, draft/published visibility and curated order.
 */
const ADMIN = {
  name: "Kofi Curator",
  email: "int-gallery-admin@example.com",
  password: "correct-horse-battery",
};
const TRAVELER = {
  name: "Tess Traveler",
  email: "int-gallery-traveler@example.com",
  password: "correct-horse-battery",
};

let app: NestExpressApplication;
let prisma: PrismaService;
let adminCookie = "";
let travelerCookie = "";
let firstId = "";
let secondId = "";

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

describe("admin gallery", () => {
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

    await request(app.getHttpServer()).get("/api/admin/gallery").expect(401);

    const forbidden = await request(app.getHttpServer())
      .get("/api/admin/gallery")
      .set("Cookie", travelerCookie)
      .expect(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");

    const list = await request(app.getHttpServer())
      .get("/api/admin/gallery")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(list.body.items).toEqual([]);
  });

  it("validates payloads", async () => {
    const server = app.getHttpServer();

    const missingImage = await request(server)
      .post("/api/admin/gallery")
      .set("Cookie", adminCookie)
      .send({ title: "No image" })
      .expect(400);
    expect(missingImage.body.error.code).toBe("VALIDATION_ERROR");

    const badUrl = await request(server)
      .post("/api/admin/gallery")
      .set("Cookie", adminCookie)
      .send({ title: "Not a URL", imageUrl: "not-a-url" })
      .expect(400);
    expect(badUrl.body.error.code).toBe("VALIDATION_ERROR");

    const emptyUpdate = await request(server)
      .patch("/api/admin/gallery/whatever")
      .set("Cookie", adminCookie)
      .send({})
      .expect(400);
    expect(emptyUpdate.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates a draft that stays out of the public gallery", async () => {
    const server = app.getHttpServer();

    const res = await request(server)
      .post("/api/admin/gallery")
      .set("Cookie", adminCookie)
      .send({
        title: "Cape Coast Castle",
        caption: "Walls above the Atlantic",
        imageUrl: "https://example.com/cape-coast.jpg",
        category: "Heritage",
        location: "Cape Coast, Central Region",
      })
      .expect(201);

    const item = res.body.item;
    firstId = item.id;

    expect(item).toMatchObject({
      title: "Cape Coast Castle",
      published: false,
      sortOrder: 0,
      category: "Heritage",
      location: "Cape Coast, Central Region",
    });
    expect(item.createdAt).toEqual(expect.any(String));

    const publicList = await request(server).get("/api/gallery").expect(200);
    expect(publicList.body.items).toEqual([]);

    const search = await request(server)
      .get("/api/admin/gallery?q=atlantic")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(search.body.items).toHaveLength(1);
    expect(search.body.items[0].id).toBe(firstId);

    const drafts = await request(server)
      .get("/api/admin/gallery?status=DRAFT")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(drafts.body.items).toHaveLength(1);

    const publishedOnly = await request(server)
      .get("/api/admin/gallery?status=PUBLISHED")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(publishedOnly.body.items).toEqual([]);
  });

  it("publishes items and returns them in curated order", async () => {
    const server = app.getHttpServer();

    const second = await request(server)
      .post("/api/admin/gallery")
      .set("Cookie", adminCookie)
      .send({
        title: "Kente weaving",
        imageUrl: "https://example.com/kente.jpg",
        category: "Craft",
        sortOrder: 2,
        published: true,
      })
      .expect(201);
    secondId = second.body.item.id;
    expect(second.body.item.published).toBe(true);

    const first = await request(server)
      .patch(`/api/admin/gallery/${firstId}`)
      .set("Cookie", adminCookie)
      .send({ published: true, sortOrder: 1 })
      .expect(200);
    expect(first.body.item.published).toBe(true);

    const publicList = await request(server).get("/api/gallery").expect(200);
    expect(publicList.body.items.map((item: { id: string }) => item.id)).toEqual([
      firstId,
      secondId,
    ]);
    expect(publicList.body.items[0]).toMatchObject({
      title: "Cape Coast Castle",
      imageUrl: "https://example.com/cape-coast.jpg",
    });
  });

  it("clears optional text, updates order and can unpublish", async () => {
    const server = app.getHttpServer();

    const updated = await request(server)
      .patch(`/api/admin/gallery/${firstId}`)
      .set("Cookie", adminCookie)
      .send({ caption: "", category: "", location: "", published: false, sortOrder: 9 })
      .expect(200);

    expect(updated.body.item.caption).toBeNull();
    expect(updated.body.item.category).toBeNull();
    expect(updated.body.item.location).toBeNull();
    expect(updated.body.item.sortOrder).toBe(9);
    expect(updated.body.item.published).toBe(false);

    const publicList = await request(server).get("/api/gallery").expect(200);
    expect(publicList.body.items.map((item: { id: string }) => item.id)).toEqual([secondId]);
  });

  it("gets, deletes and then hides gallery items", async () => {
    const server = app.getHttpServer();

    const found = await request(server)
      .get(`/api/admin/gallery/${firstId}`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(found.body.item.id).toBe(firstId);

    await request(server)
      .get("/api/admin/gallery/does-not-exist")
      .set("Cookie", adminCookie)
      .expect(404);

    await request(server)
      .delete(`/api/admin/gallery/${firstId}`)
      .set("Cookie", adminCookie)
      .expect(200);

    await request(server)
      .get(`/api/admin/gallery/${firstId}`)
      .set("Cookie", adminCookie)
      .expect(404);

    await request(server)
      .delete(`/api/admin/gallery/${firstId}`)
      .set("Cookie", adminCookie)
      .expect(404);

    await request(server)
      .delete(`/api/admin/gallery/${secondId}`)
      .set("Cookie", adminCookie)
      .expect(200);

    const publicList = await request(server).get("/api/gallery").expect(200);
    expect(publicList.body.items).toEqual([]);
  });
});
