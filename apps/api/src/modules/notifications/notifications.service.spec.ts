import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsService } from "./notifications.service";
import { ApiError } from "../../common/errors/api-error";

// PrismaService is mocked here; ownership scoping lives in the where clauses
// and is asserted on the mock calls below.
const db = {
  notification: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

const service = new NotificationsService(db as never);

const now = new Date("2026-10-20T09:00:00.000Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    userId: "u1",
    channel: "EMAIL",
    type: "PACKAGE_BOOKING_CONFIRMED",
    payload: { bookingId: "b1", code: "TB-ABC123" },
    status: "QUEUED",
    sentAt: now,
    readAt: null,
    createdAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotificationsService.list", () => {
  it("maps own rows to the traveler DTO with pagination and unread count", async () => {
    db.notification.findMany.mockResolvedValue([row(), row({ readAt: now })]);
    db.notification.count.mockImplementation(({ where }) => {
      if (where && "readAt" in where) return Promise.resolve(1);
      return Promise.resolve(2);
    });

    const result = await service.list("u1", { page: 2, pageSize: 10 });

    expect(db.notification.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { createdAt: "desc" },
      skip: 10,
      take: 10,
    });
    expect(result).toEqual({
      items: [
        {
          id: "n1",
          channel: "EMAIL",
          type: "PACKAGE_BOOKING_CONFIRMED",
          payload: { bookingId: "b1", code: "TB-ABC123" },
          status: "QUEUED",
          sentAt: now.toISOString(),
          readAt: null,
          createdAt: now.toISOString(),
        },
        {
          id: "n1",
          channel: "EMAIL",
          type: "PACKAGE_BOOKING_CONFIRMED",
          payload: { bookingId: "b1", code: "TB-ABC123" },
          status: "QUEUED",
          sentAt: now.toISOString(),
          readAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
      ],
      total: 2,
      page: 2,
      pageSize: 10,
      pages: 1,
      unread: 1,
    });
  });
});

describe("NotificationsService.markRead", () => {
  it("writes readAt on an own unread row", async () => {
    db.notification.findFirst.mockResolvedValue(row());
    db.notification.update.mockResolvedValue(row({ readAt: now }));

    const { notification } = await service.markRead("u1", "n1");

    expect(db.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { readAt: expect.any(Date) },
    });
    expect(notification.readAt).not.toBeNull();
  });

  it("is idempotent for an already-read row (no update, readAt preserved)", async () => {
    db.notification.findFirst.mockResolvedValue(row({ readAt: now }));

    const { notification } = await service.markRead("u1", "n1");

    expect(db.notification.update).not.toHaveBeenCalled();
    expect(notification.readAt).toBe(now.toISOString());
  });

  it("rejects rows that do not belong to the caller", async () => {
    db.notification.findFirst.mockResolvedValue(null);

    await expect(service.markRead("u1", "n-other")).rejects.toBeInstanceOf(ApiError);
    expect(db.notification.update).not.toHaveBeenCalled();
  });
});

describe("NotificationsService.markAllRead", () => {
  it("scopes the bulk update to the caller and their unread rows", async () => {
    db.notification.updateMany.mockResolvedValue({ count: 3 });

    const { marked } = await service.markAllRead("u1");

    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
    expect(marked).toBe(3);
  });
});
