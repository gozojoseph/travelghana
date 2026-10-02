import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";

import { AppModule } from "../src/app.module";
import { MAILER, type MailMessage, type Mailer } from "../src/modules/auth/mailer";

/**
 * Postgres-backed integration test (real DB, real HTTP stack):
 * register → verify email → me → login, plus enumeration/duplicate guards.
 */
const TEST_EMAIL = "int-ama@example.com";
const TEST_PASSWORD = "correct-horse-battery";

let app: NestExpressApplication;
const sentMail: MailMessage[] = [];

beforeAll(async () => {
  const testMailer: Mailer = {
    async send(message) {
      sentMail.push(message);
    },
  };

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

describe("auth flow (register → verify → login)", () => {
  it("registers a traveler, issues a session and queues a verification email", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ name: "Ama Mensah", email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(201);

    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user.roles).toContain("TRAVELER");
    sessionCookie(res); // registered users are logged in immediately

    const verification = sentMail.find((m) => m.subject.includes("Verify"));
    expect(verification).toBeDefined();
    expect(verification!.to).toBe(TEST_EMAIL);
  });

  it("rejects duplicate registration with 409 EMAIL_TAKEN", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ name: "Ama Again", email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects invalid credentials with 401 and no enumeration", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: "definitely-wrong" })
      .expect(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("verifies the email via the token from the email, visible on /me", async () => {
    const verification = sentMail.find((m) => m.subject.includes("Verify"))!;
    const token = /token=([A-Za-z0-9_-]+)/.exec(verification.text)?.[1];
    expect(token, "verification link should contain a token").toBeDefined();

    await request(app.getHttpServer())
      .post("/api/auth/verify-email")
      .send({ token })
      .expect(200);

    // Reusing the token must fail (single-use).
    const replay = await request(app.getHttpServer())
      .post("/api/auth/verify-email")
      .send({ token })
      .expect(400);
    expect(replay.body.error.code).toBe("INVALID_TOKEN");
  });

  it("logs in with the verified account and reports emailVerified", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    const cookie = sessionCookie(login);

    const me = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Cookie", cookie)
      .expect(200);

    expect(me.body.user.email).toBe(TEST_EMAIL);
    expect(me.body.user.emailVerified).toBe(true);
    expect(me.body.user.roles).toContain("TRAVELER");
  });

  it("rejects unauthorized /me without a session", async () => {
    const res = await request(app.getHttpServer()).get("/api/auth/me").expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});
