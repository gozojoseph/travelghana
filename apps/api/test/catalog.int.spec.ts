import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma.service";
import { MAILER, type Mailer } from "../src/modules/auth/mailer";

/**
 * Postgres-backed integration test of the public catalog: only published
 * listings are browsable; detail is keyed by provider slug + listing slug.
 */
const OPERATOR = { name: "Esi Catalog", email: "int-catalog@example.com", password: "correct-horse-battery" };

let app: NestExpressApplication;
let prisma: PrismaService;

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
});

afterAll(async () => {
  await app?.close();
});

describe("public catalog", () => {
  let providerSlug = "";

  beforeAll(async () => {
    // Seed through the real operator flow: register → onboard → listings.
    const register = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send(OPERATOR)
      .expect(201);
    const cookie = (register.headers["set-cookie"] as string[])[0]!.split(";")[0]!;

    const provider = await request(app.getHttpServer())
      .post("/api/operator/providers")
      .set("Cookie", cookie)
      .send({ type: "TOUR_OPERATOR", name: "Volta River Cruises" })
      .expect(201);
    providerSlug = provider.body.provider.slug;

    await request(app.getHttpServer())
      .post("/api/operator/me/tours")
      .set("Cookie", cookie)
      .send({ title: "Sunset Volta Cruise", basePriceMinor: 60000, published: true })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/operator/me/tours")
      .set("Cookie", cookie)
      .send({ title: "Secret Waterfall Trek", basePriceMinor: 90000 }) // draft
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/operator/me/experiences")
      .set("Cookie", cookie)
      .send({ title: "Drumming Circle", priceMinor: 15000, published: true })
      .expect(201);

    // Attractions are public editorial data; seed one with place context.
    const region = await prisma.region.create({
      data: { slug: "int-catalog-region", name: "Catalog Region" },
      select: { id: true },
    });
    const city = await prisma.city.create({
      data: {
        regionId: region.id,
        slug: "int-catalog-city",
        name: "Catalog City",
        lat: 5.05,
        lng: -1.1,
      },
      select: { id: true },
    });
    await prisma.attraction.create({
      data: {
        cityId: city.id,
        slug: "int-catalog-estuary",
        name: "Estuary Boardwalk",
        description: "A quiet lagoon walk",
        category: "NATURE",
        lat: 5.05,
        lng: -1.1,
      },
    });
  });

  it("lists published tours with provider context", async () => {
    // Scoped by q so other integration files publishing tours into the shared
    // test database cannot change this count (files run in parallel).
    const res = await request(app.getHttpServer())
      .get("/api/catalog/tours?q=Sunset")
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].title).toBe("Sunset Volta Cruise");
    expect(res.body.items[0].provider.slug).toBe(providerSlug);
    expect(res.body.items[0].published).toBe(true);
  });

  it("hides drafts", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/catalog/tours?q=Secret Waterfall")
      .expect(200);
    expect(res.body.total).toBe(0);
  });

  it("filters tours by search term", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/catalog/tours?q=sunset")
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].slug).toBe("sunset-volta-cruise");
  });

  it("serves tour detail by provider slug + tour slug", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/catalog/tours/${providerSlug}/sunset-volta-cruise`)
      .expect(200);

    expect(res.body.title).toBe("Sunset Volta Cruise");
    expect(res.body.provider.name).toBe("Volta River Cruises");
  });

  it("404s for drafts and unknown slugs (no existence oracle)", async () => {
    await request(app.getHttpServer())
      .get(`/api/catalog/tours/${providerSlug}/secret-waterfall-trek`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/catalog/tours/${providerSlug}/does-not-exist`)
      .expect(404);
  });

  it("lists published experiences", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/catalog/experiences?q=Drumming")
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].title).toBe("Drumming Circle");
    expect(res.body.items[0].provider.slug).toBe(providerSlug);
  });

  it("lists public attractions with city and region context", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/catalog/attractions?q=Estuary")
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      name: "Estuary Boardwalk",
      category: "NATURE",
      city: {
        slug: "int-catalog-city",
        name: "Catalog City",
        region: { slug: "int-catalog-region", name: "Catalog Region" },
      },
    });
  });
});
