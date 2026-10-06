import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";

import { AppModule } from "../src/app.module";
import { MAILER, type Mailer } from "../src/modules/auth/mailer";

/**
 * Postgres-backed integration test of the operator increment (D5):
 * register → onboard provider → role granted → tour/experience CRUD,
 * ownership scoping and RBAC on listing routes.
 */
const OPERATOR = { name: "Kofi Operator", email: "int-operator@example.com", password: "correct-horse-battery" };
const RIVAL = { name: "Rita Rival", email: "int-rival@example.com", password: "correct-horse-battery" };

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

let operatorCookie = "";
let rivalCookie = "";
let tourId = "";
let experienceId = "";

describe("operator onboarding + listings", () => {
  it("blocks listing routes before onboarding (RBAC)", async () => {
    rivalCookie = await register(RIVAL);

    // Not even logged in → 401.
    await request(app.getHttpServer()).get("/api/operator/me/tours").expect(401);

    // Logged in but no operator role → 403.
    const res = await request(app.getHttpServer())
      .get("/api/operator/me/tours")
      .set("Cookie", rivalCookie)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("onboards an operator and grants the role", async () => {
    operatorCookie = await register(OPERATOR);

    const res = await request(app.getHttpServer())
      .post("/api/operator/providers")
      .set("Cookie", operatorCookie)
      .send({ type: "TOUR_OPERATOR", name: "Accra Adventures", description: "Tours around Accra" })
      .expect(201);

    expect(res.body.provider.name).toBe("Accra Adventures");
    expect(res.body.provider.slug).toBe("accra-adventures");
    expect(res.body.provider.verificationStatus).toBe("UNVERIFIED");

    // Role now active → listing routes open; slug is unique per re-run.
    const list = await request(app.getHttpServer())
      .get("/api/operator/me/tours")
      .set("Cookie", operatorCookie)
      .expect(200);
    expect(list.body.items).toEqual([]);
  });

  it("rejects a second provider with 409 PROVIDER_EXISTS", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/operator/providers")
      .set("Cookie", operatorCookie)
      .send({ type: "HOTEL", name: "Another One" })
      .expect(409);
    expect(res.body.error.code).toBe("PROVIDER_EXISTS");
  });

  it("validates the payload (400 VALIDATION_ERROR)", async () => {
    await request(app.getHttpServer())
      .post("/api/operator/me/tours")
      .set("Cookie", operatorCookie)
      .send({ title: "x", basePriceMinor: -5 })
      .expect(400);
  });

  it("creates, updates, publishes and deletes a tour", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/operator/me/tours")
      .set("Cookie", operatorCookie)
      .send({
        title: "Cape Coast & Elmina Day Trip",
        summary: "Castles and history",
        basePriceMinor: 85000,
        groupMin: 2,
        groupMax: 12,
      })
      .expect(201);

    tourId = created.body.tour.id;
    expect(created.body.tour.slug).toBe("cape-coast-elmina-day-trip");
    expect(created.body.tour.published).toBe(false);
    expect(created.body.tour.currencyCode).toBe("GHS");

    const patched = await request(app.getHttpServer())
      .patch(`/api/operator/me/tours/${tourId}`)
      .set("Cookie", operatorCookie)
      .send({ published: true, title: "Cape Coast & Elmina Heritage Trip" })
      .expect(200);

    expect(patched.body.tour.published).toBe(true);
    expect(patched.body.tour.slug).toBe("cape-coast-elmina-heritage-trip");

    const list = await request(app.getHttpServer())
      .get("/api/operator/me/tours")
      .set("Cookie", operatorCookie)
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].title).toBe("Cape Coast & Elmina Heritage Trip");

    await request(app.getHttpServer())
      .delete(`/api/operator/me/tours/${tourId}`)
      .set("Cookie", operatorCookie)
      .expect(200);

    const after = await request(app.getHttpServer())
      .get("/api/operator/me/tours")
      .set("Cookie", operatorCookie)
      .expect(200);
    expect(after.body.items).toHaveLength(0);
  });

  it("creates an experience and hides rivals' listings (ownership scoping)", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/operator/me/experiences")
      .set("Cookie", operatorCookie)
      .send({ title: "Kente Weaving Workshop", priceMinor: 25000, durationMinutes: 120 })
      .expect(201);

    experienceId = created.body.experience.id;
    expect(created.body.experience.slug).toBe("kente-weaving-workshop");

    // Rival (no provider) gets 403 on listing routes...
    await request(app.getHttpServer())
      .get("/api/operator/me/experiences")
      .set("Cookie", rivalCookie)
      .expect(403);

    // ...and an unknown id yields 404 (no existence oracle either way).
    await request(app.getHttpServer())
      .patch("/api/operator/me/tours/does-not-exist")
      .set("Cookie", operatorCookie)
      .send({ published: true })
      .expect(404);
  });

  it("keeps the experience retrievable until deleted", async () => {
    const list = await request(app.getHttpServer())
      .get("/api/operator/me/experiences")
      .set("Cookie", operatorCookie)
      .expect(200);
    expect(list.body.items.map((e: { id: string }) => e.id)).toContain(experienceId);

    await request(app.getHttpServer())
      .delete(`/api/operator/me/experiences/${experienceId}`)
      .set("Cookie", operatorCookie)
      .expect(200);
  });
});
