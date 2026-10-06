import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";

import { AppModule } from "../src/app.module";
import { MAILER, type Mailer } from "../src/modules/auth/mailer";

/**
 * Postgres-backed integration test of the public catalog: only published
 * listings are browsable; detail is keyed by provider slug + listing slug.
 */
const OPERATOR = { name: "Esi Catalog", email: "int-catalog@example.com", password: "correct-horse-battery" };

let app: NestExpressApplication;

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
  });

  it("lists published tours with provider context", async () => {
    const res = await request(app.getHttpServer()).get("/api/catalog/tours").expect(200);

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
    const res = await request(app.getHttpServer()).get("/api/catalog/experiences").expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].title).toBe("Drumming Circle");
    expect(res.body.items[0].provider.slug).toBe(providerSlug);
  });
});
