import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";

import { BrevoMailer, buildMailer, ConsoleMailer, type MailMessage } from "./mailer";

// Process.env is process-global in vitest; snapshot and restore the keys the
// factory reads so other spec files are unaffected.
const KEYS = ["MAILER_PROVIDER", "BREVO_API_KEY", "MAIL_FROM_EMAIL", "MAIL_FROM_NAME"];
const ORIGINAL = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

const message: MailMessage = {
  to: "traveler@example.com",
  subject: "Reset your TravelGhana password",
  text: "Hi,\n\nReset your password: https://travelghana.com/reset-password?token=abc",
};

beforeAll(() => {
  vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of KEYS) {
    const original = ORIGINAL[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe("buildMailer provider selection", () => {
  it("defaults to the console mailer", () => {
    delete process.env.MAILER_PROVIDER;
    expect(buildMailer()).toBeInstanceOf(ConsoleMailer);
  });

  it("degrades a not-fully-configured brevo setting to the console mailer", () => {
    process.env.MAILER_PROVIDER = "brevo";
    delete process.env.BREVO_API_KEY;
    delete process.env.MAIL_FROM_EMAIL;
    expect(buildMailer()).toBeInstanceOf(ConsoleMailer);
  });

  it("builds the Brevo mailer with a fully configured brevo provider", () => {
    process.env.MAILER_PROVIDER = "brevo";
    process.env.BREVO_API_KEY = "key-abc";
    process.env.MAIL_FROM_EMAIL = "bookings@travelghana.com";
    process.env.MAIL_FROM_NAME = "TravelGhana";
    expect(buildMailer()).toBeInstanceOf(BrevoMailer);
  });

  it("falls back to the console mailer for an unknown provider value", () => {
    process.env.MAILER_PROVIDER = "sendgrid";
    expect(buildMailer()).toBeInstanceOf(ConsoleMailer);
  });
});

describe("BrevoMailer", () => {
  function stubFetch(response: { ok: boolean; status: number }) {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const mailer = new BrevoMailer("key-abc", "bookings@travelghana.com", "TravelGhana");

  it("POSTs the Brevo payload with sender, recipient, subject and text", async () => {
    const fetchMock = stubFetch({ ok: true, status: 201 });
    await mailer.send(message);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("expected fetch to be called");
    const [url, init] = call as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeDefined();
    const headers = init.headers as Record<string, string>;
    expect(headers["api-key"]).toBe("key-abc");
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(String(init.body));
    expect(body.sender).toEqual({ name: "TravelGhana", email: "bookings@travelghana.com" });
    expect(body.to).toEqual([{ email: "traveler@example.com" }]);
    expect(body.subject).toBe("Reset your TravelGhana password");
    expect(body.textContent).toContain("reset-password?token=abc");
    expect(body.htmlContent).toBeUndefined();
  });

  it("maps html to Brevo's htmlContent field", async () => {
    const fetchMock = stubFetch({ ok: true, status: 201 });
    await mailer.send({ ...message, html: "<p>Reset link</p>" });
    const htmlCall = fetchMock.mock.calls[0];
    if (!htmlCall) throw new Error("expected fetch to be called");
    const body = JSON.parse(String((htmlCall[1] as RequestInit).body));
    expect(body.htmlContent).toBe("<p>Reset link</p>");
  });

  it("resolves (never throws) when Brevo rejects the credentials", async () => {
    stubFetch({ ok: false, status: 401 });
    await expect(mailer.send(message)).resolves.toBeUndefined();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining("HTTP 401"));
  });

  it("resolves with a rate-limit warning on 429", async () => {
    stubFetch({ ok: false, status: 429 });
    await expect(mailer.send(message)).resolves.toBeUndefined();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining("rate limited"));
  });

  it("resolves (never throws) when the network itself fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(mailer.send(message)).resolves.toBeUndefined();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining("connect ECONNREFUSED"),
    );
  });
});
