import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildFunnel, InsightsService } from "./insights.service";

// PrismaService is mocked here; the raw SQL aggregates are verified live
// against Neon (same posture as the other service specs).
const db = {
  pageView: { createMany: vi.fn(), findMany: vi.fn() },
  user: { findMany: vi.fn() },
  packageBooking: { count: vi.fn() },
  $queryRaw: vi.fn(),
};

const service = new InsightsService(db as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InsightsService.record", () => {
  it("writes browser batches correlating the server-resolved userId", async () => {
    db.pageView.createMany.mockResolvedValue({ count: 2 });

    const accepted = await service.record(
      [
        {
          sessionId: "sess-1234567",
          visitorId: "visitor-12345",
          path: "/packages/cocoa-trail",
          referrer: null,
          device: "phone",
          kind: "view",
        },
        {
          sessionId: "sess-1234567",
          visitorId: "visitor-12345",
          path: "/packages/cocoa-trail",
          referrer: "https://example.com",
          device: "phone",
          kind: "action",
          name: "booking_started",
          meta: { step: "1" },
        },
      ],
      "u1",
    );

    expect(accepted).toBe(2);
    const args = db.pageView.createMany.mock.calls[0]?.[0] as
      | { data: Array<Record<string, unknown>> }
      | undefined;
    expect(args).toBeDefined();
    if (!args) return;
    expect(args.data).toHaveLength(2);
    expect(args.data[0]).toMatchObject({
      userId: "u1",
      kind: "view",
      name: null,
      referrer: null,
    });
    expect(args.data[1]).toMatchObject({
      kind: "action",
      name: "booking_started",
      meta: { step: "1" },
    });
  });

  it("never surfaces storage failures (tracking must not break UX)", async () => {
    db.pageView.createMany.mockRejectedValue(new Error("boom"));

    const accepted = await service.record(
      [
        {
          sessionId: "sess-1234567",
          visitorId: "visitor-12345",
          path: "/",
          referrer: null,
          device: "desktop",
          kind: "view",
        },
      ],
      null,
    );

    expect(accepted).toBe(0);
  });
});

describe("buildFunnel", () => {
  it("keeps labels in funnel order and rates against the first step", () => {
    const funnel = buildFunnel([10, 8, 4, 2, 1]);

    expect(funnel.map((step) => step.sessions)).toEqual([10, 8, 4, 2, 1]);
    expect(funnel.map((step) => step.rate)).toEqual([100, 80, 40, 20, 10]);
    expect(funnel[2]?.label).toBe("Opened a specific package");
    expect(funnel[4]?.label).toBe("Created a booking");
  });

  it("stays 0-safe when there is no traffic", () => {
    expect(buildFunnel([0, 0, 0, 0, 0]).every((step) => step.rate === 0)).toBe(true);
  });
});

describe("InsightsService.sessionTimeline", () => {
  it("maps rows oldest-first and joins the signed-in email", async () => {
    db.pageView.findMany.mockResolvedValue([
      {
        id: "e2",
        sessionId: "sess-1234567",
        visitorId: "visitor-12345",
        userId: "u1",
        path: "/packages/x",
        referrer: null,
        device: "phone",
        kind: "view",
        name: null,
        meta: null,
        occurredAt: new Date("2026-10-22T10:01:00Z"),
      },
      {
        id: "e1",
        sessionId: "sess-1234567",
        visitorId: "visitor-12345",
        userId: null,
        path: "/",
        referrer: null,
        device: "phone",
        kind: "view",
        name: null,
        meta: null,
        occurredAt: new Date("2026-10-22T10:00:00Z"),
      },
    ]);
    db.user.findMany.mockResolvedValue([{ id: "u1", email: "x@y.z" }]);

    const detail = await service.sessionTimeline("sess-1234567");

    expect(detail.events[0]?.id).toBe("e1");
    expect(detail.events[0]?.email).toBeNull();
    expect(detail.events[1]?.email).toBe("x@y.z");
    expect(detail.events[0]?.occurredAt).toBe("2026-10-22T10:00:00.000Z");
  });
});
