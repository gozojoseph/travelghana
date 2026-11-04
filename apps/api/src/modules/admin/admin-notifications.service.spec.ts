import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminNotificationsService } from "./admin-notifications.service";

// PrismaService is mocked here; the Postgres-backed behaviour is covered by
// test/enquiries.int.spec.ts (which exercises the real delete route).
const db = {
  notification: { findUnique: vi.fn(), delete: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  auditLog: { create: vi.fn() },
};

const service = new AdminNotificationsService(db as never);

beforeEach(() => {
  vi.clearAllMocks();
  db.auditLog.create.mockResolvedValue({});
  db.notification.delete.mockResolvedValue({});
});

describe("AdminNotificationsService.remove", () => {
  it("deletes a queued record and audits the cleanup", async () => {
    db.notification.findUnique.mockResolvedValue({
      id: "ntf-1",
      status: "QUEUED",
      type: "ENQUIRY_RECEIVED",
      userId: "user-1",
    });

    const result = await service.remove("admin-1", "ntf-1");

    expect(result.message).toBe("Notification deleted");
    expect(db.notification.delete).toHaveBeenCalledWith({ where: { id: "ntf-1" } });
    const audit = db.auditLog.create.mock.calls[0]![0].data;
    expect(audit.action).toBe("NOTIFICATION_DELETED");
    expect(audit.entityType).toBe("Notification");
    expect(audit.entityId).toBe("ntf-1");
    expect(audit.actorUserId).toBe("admin-1");
    expect(audit.meta).toEqual({ type: "ENQUIRY_RECEIVED", status: "QUEUED", userId: "user-1" });
  });

  it("also deletes failed records (delivery never happened)", async () => {
    db.notification.findUnique.mockResolvedValue({
      id: "ntf-2",
      status: "FAILED",
      type: "LISTING_APPROVED",
      userId: "user-2",
    });

    await expect(service.remove("admin-1", "ntf-2")).resolves.toEqual({
      message: "Notification deleted",
    });
  });

  it("refuses sent records - they are delivery history", async () => {
    db.notification.findUnique.mockResolvedValue({
      id: "ntf-3",
      status: "SENT",
      type: "ENQUIRY_RECEIVED",
      userId: "user-1",
    });

    await expect(service.remove("admin-1", "ntf-3")).rejects.toMatchObject({
      status: 409,
      code: "SENT_RECORD_IMMUTABLE",
    });
    expect(db.notification.delete).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("404s on an unknown record", async () => {
    db.notification.findUnique.mockResolvedValue(null);

    await expect(service.remove("admin-1", "ntf-missing")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    expect(db.notification.delete).not.toHaveBeenCalled();
  });
});
