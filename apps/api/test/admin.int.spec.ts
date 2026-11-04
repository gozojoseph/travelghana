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
 * Postgres-backed integration test of the admin console API (D20):
 * dashboard stats, user/role management with its guardrails, provider
 * verification (with queued notifications), the listing review queue
 * (audit + notifications), the audit trail and the notification outbox.
 */
const ADMIN = {
  name: "Ada Console",
  email: "int-admin-console@example.com",
  password: "correct-horse-battery",
};
const RIVAL = {
  name: "Rima Rival",
  email: "int-admin-rival@example.com",
  password: "correct-horse-battery",
};

let app: NestExpressApplication;
let prisma: PrismaService;
let adminCookie = "";
let rivalCookie = "";
let adminId = "";
let rivalId = "";

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
  rivalCookie = await register(RIVAL);

  adminId = (await userId(ADMIN.email))!;
  rivalId = (await userId(RIVAL.email))!;
  await prisma.roleMembership.create({
    data: { userId: adminId, role: Role.ADMIN, status: "ACTIVE" },
  });
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

async function userId(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  });
  return user.id;
}

function login(email: string, password: string) {
  return request(app.getHttpServer()).post("/api/auth/login").send({ email, password });
}

describe("RBAC: every admin endpoint requires an active ADMIN membership", () => {
const surfaces: Array<{ method: "get" | "post" | "patch"; path: string; body?: object }> = [
  { method: "get", path: "/api/admin/stats" },
  { method: "get", path: "/api/admin/users" },
  // Placeholder id: authorization guards run before param validation, so an
  // unknown id must still produce 401/403 — not a param-validation 400.
  { method: "patch", path: "/api/admin/users/0000-under-guard", body: { status: "SUSPENDED" } },
  { method: "get", path: "/api/admin/providers" },
  { method: "patch", path: "/api/admin/providers/0000-under-guard", body: { verificationStatus: "VERIFIED" } },
  { method: "get", path: "/api/admin/audit" },
  { method: "get", path: "/api/admin/notifications" },
];

  for (const surface of surfaces) {
    it(`anon is 401 and a non-admin is 403 on ${surface.method.toUpperCase()} ${surface.path}`, async () => {
      const anon = await request(app.getHttpServer())[surface.method](surface.path)
        .send(surface.body ?? {})
        .expect(401);
      expect(anon.body.error.code).toBe("UNAUTHORIZED");

      const rival = await request(app.getHttpServer())[surface.method](surface.path)
        .set("Cookie", rivalCookie)
        .send(surface.body ?? {})
        .expect(403);
      expect(rival.body.error.code).toBe("FORBIDDEN");
    });
  }

  it("admin passes on the read surfaces", async () => {
    await request(app.getHttpServer()).get("/api/admin/stats").set("Cookie", adminCookie).expect(200);
    await request(app.getHttpServer()).get("/api/admin/users").set("Cookie", adminCookie).expect(200);
    await request(app.getHttpServer()).get("/api/admin/providers").set("Cookie", adminCookie).expect(200);
    await request(app.getHttpServer()).get("/api/admin/audit").set("Cookie", adminCookie).expect(200);
    await request(app.getHttpServer()).get("/api/admin/notifications").set("Cookie", adminCookie).expect(200);
  });
});

describe("dashboard stats", () => {
  it("returns every shipped KPI counter plus a live snapshot", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/admin/stats")
      .set("Cookie", adminCookie)
      .expect(200);

    const stats = res.body.stats;
    expect(Object.keys(stats.counts).sort()).toEqual(
      [
        "destinationsUnpublished",
        "enquiriesNew",
        "enquiriesUnassignedActive",
        "attractionsUnpublished",
        "listingsPendingReview",
        "notificationsQueued",
        "packageBookingsPending",
        "packagesDraft",
        "providersUnverified",
        "usersActive",
      ].sort(),
    );
    for (const value of Object.values(stats.counts) as number[]) {
      expect(typeof value).toBe("number");
    }
    expect(Array.isArray(stats.recent.enquiries)).toBe(true);
    expect(Array.isArray(stats.recent.listings)).toBe(true);
    expect(Array.isArray(stats.recent.audit)).toBe(true);
    expect(new Date(stats.generatedAt).toString()).not.toBe("Invalid Date");
  });
});

describe("users & roles", () => {
  it("searches and returns active roles only", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/admin/users")
      .query({ q: RIVAL.email })
      .set("Cookie", adminCookie)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    const rival = res.body.items[0];
    expect(rival.email).toBe(RIVAL.email);
    expect(rival.roles).toEqual(["TRAVELER"]);
    expect(rival.status).toBe("ACTIVE");
    expect(rival.providerId).toBeNull();
  });

  it("rejects an empty patch with 400", async () => {
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${rivalId}`)
      .set("Cookie", adminCookie)
      .send({})
      .expect(400);
  });

  it("grants and revokes roles, auditing each change", async () => {
    const grant = await request(app.getHttpServer())
      .patch(`/api/admin/users/${rivalId}`)
      .set("Cookie", adminCookie)
      .send({ addRoles: ["TOUR_OPERATOR"] })
      .expect(200);
    expect(grant.body.user.roles).toEqual(["TRAVELER", "TOUR_OPERATOR"]);
    expect(grant.body.message).toContain("added TOUR_OPERATOR");

    const revoke = await request(app.getHttpServer())
      .patch(`/api/admin/users/${rivalId}`)
      .set("Cookie", adminCookie)
      .send({ removeRoles: ["TOUR_OPERATOR"] })
      .expect(200);
    expect(revoke.body.user.roles).toEqual(["TRAVELER"]);

    const audits = await request(app.getHttpServer())
      .get("/api/admin/audit")
      .query({ action: "user_updated" })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(audits.body.items.length).toBeGreaterThanOrEqual(2);
    const row = audits.body.items[0];
    expect(row.entityType).toBe("User");
    expect(row.actorEmail).toBe(ADMIN.email);
  });

  it("blocks self-demotion and self-suspension", async () => {
    const demote = await request(app.getHttpServer())
      .patch(`/api/admin/users/${adminId}`)
      .set("Cookie", adminCookie)
      .send({ removeRoles: ["ADMIN"] })
      .expect(409);
    expect(demote.body.error.code).toBe("SELF_DEMOTE");

    const suspend = await request(app.getHttpServer())
      .patch(`/api/admin/users/${adminId}`)
      .set("Cookie", adminCookie)
      .send({ status: "SUSPENDED" })
      .expect(409);
    expect(suspend.body.error.code).toBe("SELF_SUSPEND");
  });

  it("suspends a user, blocks their next login, and reactivates them", async () => {
    const suspend = await request(app.getHttpServer())
      .patch(`/api/admin/users/${rivalId}`)
      .set("Cookie", adminCookie)
      .send({ status: "SUSPENDED" })
      .expect(200);
    expect(suspend.body.user.status).toBe("SUSPENDED");

    const blockedLogin = await login(RIVAL.email, RIVAL.password).expect(403);
    expect(blockedLogin.body.error.code).toBe("ACCOUNT_SUSPENDED");

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${rivalId}`)
      .set("Cookie", adminCookie)
      .send({ status: "ACTIVE" })
      .expect(200);
    await login(RIVAL.email, RIVAL.password).expect(200);
  });

  it("filters by status", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/admin/users")
      .query({ status: "ACTIVE", q: RIVAL.email })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(res.body.items).toHaveLength(1);
  });
});

describe("providers + listing review queue", () => {
  let providerId = "";
  let listingId = "";
  let pendingBefore = 0;

  it("onboards rival as a provider (UNVERIFIED) and shows them in the queue", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/operator/providers")
      .set("Cookie", rivalCookie)
      .send({
        type: "TOUR_OPERATOR",
        name: "Admin Test Adventures",
        description: "Tours for the admin console test",
      })
      .expect(201);
    providerId = created.body.provider.id;
    expect(created.body.provider.verificationStatus).toBe("UNVERIFIED");

    const queue = await request(app.getHttpServer())
      .get("/api/admin/providers")
      .query({ verificationStatus: "UNVERIFIED", q: "Admin Test Adventures" })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(queue.body.items).toHaveLength(1);
    expect(queue.body.items[0]).toMatchObject({
      id: providerId,
      userEmail: RIVAL.email,
      listingsTotal: 0,
      listingsPublished: 0,
    });
  });

  it("verifies the provider, queues a notification, and audits once (no duplicates on no-op)", async () => {
    const verified = await request(app.getHttpServer())
      .patch(`/api/admin/providers/${providerId}`)
      .set("Cookie", adminCookie)
      .send({ verificationStatus: "VERIFIED" })
      .expect(200);
    expect(verified.body.provider.verificationStatus).toBe("VERIFIED");

    const notifications = await request(app.getHttpServer())
      .get("/api/admin/notifications")
      .query({ type: "PROVIDER_VERIFICATION", userId: rivalId })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(notifications.body.items).toHaveLength(1);
    expect(notifications.body.items[0]).toMatchObject({
      status: "QUEUED",
      payload: expect.objectContaining({
        providerId,
        verificationStatus: "VERIFIED",
      }),
    });

    const audits = await request(app.getHttpServer())
      .get("/api/admin/audit")
      .query({ action: "provider_verification_updated" })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(audits.body.items).toHaveLength(1);

    // Same status again → no-op: nothing new audited.
    await request(app.getHttpServer())
      .patch(`/api/admin/providers/${providerId}`)
      .set("Cookie", adminCookie)
      .send({ verificationStatus: "VERIFIED" })
      .expect(200);
    const auditsAfter = await request(app.getHttpServer())
      .get("/api/admin/audit")
      .query({ action: "provider_verification_updated" })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(auditsAfter.body.items).toHaveLength(1);
  });

  it("counts a submitted listing in the stats and queue with resolved names", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/listings/me")
      .set("Cookie", rivalCookie)
      .send({
        title: "Admin Review Probe Tour",
        capacity: 4,
        priceMinor: 250_000,
        currencyCode: "GHS",
      })
      .expect(201);
    listingId = created.body.listing.id;
    expect(created.body.listing.status).toBe("DRAFT");

    const statsBefore = await request(app.getHttpServer())
      .get("/api/admin/stats")
      .set("Cookie", adminCookie)
      .expect(200);
    pendingBefore = statsBefore.body.stats.counts.listingsPendingReview;

    await request(app.getHttpServer())
      .patch(`/api/listings/me/${listingId}/status`)
      .set("Cookie", rivalCookie)
      .send({ status: "PENDING_REVIEW" })
      .expect(200);

    const stats = await request(app.getHttpServer())
      .get("/api/admin/stats")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(stats.body.stats.counts.listingsPendingReview).toBe(pendingBefore + 1);

    const queue = await request(app.getHttpServer())
      .get("/api/listings/admin")
      .query({ id: "PENDING_REVIEW" })
      .set("Cookie", adminCookie)
      .expect(200);
    const row = queue.body.items.find((item: { id: string }) => item.id === listingId);
    expect(row).toBeTruthy();
    expect(row.providerName).toBe("Admin Test Adventures");
    expect(stats.body.stats.recent.listings.some((l: { id: string }) => l.id === listingId)).toBe(true);
  });

  it("requires a reason to reject, and records it in the audit + notification", async () => {
    await request(app.getHttpServer())
      .patch(`/api/listings/admin/${listingId}/review`)
      .set("Cookie", adminCookie)
      .send({ reviewStatus: "REJECT" })
      .expect(400);

    const rejected = await request(app.getHttpServer())
      .patch(`/api/listings/admin/${listingId}/review`)
      .set("Cookie", adminCookie)
      .send({ reviewStatus: "REJECT", note: "Photos are blurry and the price is missing" })
      .expect(200);
    expect(rejected.body.listing.status).toBe("DRAFT");
    expect(rejected.body.listing.publishedAt).toBeNull();

    const audits = await request(app.getHttpServer())
      .get("/api/admin/audit")
      .query({ action: "listing_reviewed" })
      .set("Cookie", adminCookie)
      .expect(200);
    const row = audits.body.items.find((item: { entityId: string }) => item.entityId === listingId);
    expect(row).toBeTruthy();
    expect(row.meta).toMatchObject({ decision: "REJECT", to: "DRAFT", note: expect.stringContaining("Photos are blurry") });

    const notifications = await request(app.getHttpServer())
      .get("/api/admin/notifications")
      .query({ type: "LISTING_REVIEW_DECISION", userId: rivalId })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(notifications.body.items).toHaveLength(1);
    expect(notifications.body.items[0].payload).toMatchObject({ decision: "REJECT" });
  });

  it("refuses to review a listing that is not PENDING_REVIEW (409)", async () => {
    const retry = await request(app.getHttpServer())
      .patch(`/api/listings/admin/${listingId}/review`)
      .set("Cookie", adminCookie)
      .send({ reviewStatus: "APPROVE" })
      .expect(409);
    expect(retry.body.error.code).toBe("INVALID_STATE");
  });

  it("approves on resubmission and restores the stats baseline", async () => {
    await request(app.getHttpServer())
      .patch(`/api/listings/me/${listingId}/status`)
      .set("Cookie", rivalCookie)
      .send({ status: "PENDING_REVIEW" })
      .expect(200);

    const approved = await request(app.getHttpServer())
      .patch(`/api/listings/admin/${listingId}/review`)
      .set("Cookie", adminCookie)
      .send({ reviewStatus: "APPROVE" })
      .expect(200);
    expect(approved.body.listing.status).toBe("PUBLISHED");
    expect(approved.body.listing.publishedAt).not.toBeNull();

    const stats = await request(app.getHttpServer())
      .get("/api/admin/stats")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(stats.body.stats.counts.listingsPendingReview).toBe(pendingBefore);
  });
});

describe("audit trail", () => {
  it("filters by entity type and actor", async () => {
    const byEntity = await request(app.getHttpServer())
      .get("/api/admin/audit")
      .query({ entityType: "Provider" })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(byEntity.body.items.length).toBeGreaterThanOrEqual(1);
    expect(byEntity.body.items.every((row: { entityType: string }) => row.entityType === "Provider")).toBe(true);

    const byActor = await request(app.getHttpServer())
      .get("/api/admin/audit")
      .query({ actor: adminId })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(
      byActor.body.items.every(
        (row: { actorEmail: string | null }) => row.actorEmail === ADMIN.email,
      ),
    ).toBe(true);
  });
});
