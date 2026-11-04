import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../common/errors/api-error";

import { EnquiriesService } from "./enquiries.service";

// PrismaService + Mailer are mocked here; the Postgres-backed behaviour is
// covered by test/enquiries.int.spec.ts.
const db = {
  trip: { findFirst: vi.fn() },
  destination: { findMany: vi.fn() },
  enquiry: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  notification: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};
const mailer = { send: vi.fn() };

const service = new EnquiriesService(db as never, mailer as never);

const now = new Date("2026-10-19T12:00:00.000Z");

function enquiryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "enq-1",
    code: "ENQ-AB2CD3",
    name: "Ama Boateng",
    email: "ama@example.com",
    phone: null,
    tripId: null,
    startDate: null,
    endDate: null,
    adults: 2,
    children: 0,
    destinations: [],
    interests: [],
    budgetRange: null,
    accommodationPref: null,
    transportPref: null,
    specialRequests: "Birding in the north if possible",
    status: "NEW",
    assignedAdminId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const requester = { id: "user-1", email: "ama@example.com", name: "Ama" };

beforeEach(() => {
  vi.clearAllMocks();
  db.auditLog.create.mockResolvedValue({});
  mailer.send.mockResolvedValue(undefined);
});

describe("EnquiriesService.create", () => {
  it("stores a guest enquiry with a minted human code and emails a confirmation", async () => {
    db.enquiry.create.mockImplementation(({ data }) =>
      Promise.resolve({ ...enquiryRow(), ...data, id: "enq-1" }),
    );
    db.enquiry.findUnique.mockResolvedValue(enquiryRow());

    const enquiry = await service.create({
      name: "Ama Boateng",
      email: "ama@example.com",
      specialRequests: "Birding in the north if possible",
    });

    const call = db.enquiry.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data.code).toMatch(/^ENQ-[A-HJ-NP-Z2-9]{6}$/);
    expect(call.data.userId).toBeNull();
    expect(call.data.tripId).toBeNull();
    expect(call.data.status ?? "NEW").toBe("NEW");
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ama@example.com", subject: expect.stringContaining("ENQ-") }),
    );
    expect(db.notification.create).not.toHaveBeenCalled(); // guests have no account row
    expect(enquiry.email).toBe("ama@example.com");
  });

  it("defaults contact details from the signed-in account", async () => {
    db.enquiry.create.mockResolvedValue(enquiryRow({ name: "Ama", email: "ama@example.com" }) as never);
    db.enquiry.findUnique.mockResolvedValue(enquiryRow({ name: "Ama", email: "ama@example.com" }) as never);

    await service.create({ specialRequests: "Hello" }, requester);

    const call = db.enquiry.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data.name).toBe("Ama");
    expect(call.data.email).toBe("ama@example.com");
    expect(call.data.userId).toBe("user-1");
    expect(db.notification.create).toHaveBeenCalledTimes(1);
  });

  it("demands contact details when nothing can be derived", async () => {
    await expect(service.create({ specialRequests: "Just a nudge" })).rejects.toMatchObject({
      status: 400,
      code: "MISSING_CONTACT",
    } satisfies Partial<ApiError>);
    expect(db.enquiry.create).not.toHaveBeenCalled();
  });

  it("enriches trip-linked enquiries from the owned trip snapshot", async () => {
    db.trip.findFirst.mockResolvedValue({
      id: "trip-9",
      startDate: new Date("2026-12-01T00:00:00.000Z"),
      endDate: new Date("2026-12-04T00:00:00.000Z"),
      adults: 3,
      children: 1,
      interests: ["FOOD_CUISINE", "NATURE_WILDLIFE"],
      destinationPreferences: ["dest-1", "dest-2"],
      budgetMinor: 450_000,
      budgetType: "PER_PERSON",
      budgetIncludesFlights: true,
      currencyCode: "GHS",
    });
    db.destination.findMany.mockResolvedValue([
      { id: "dest-1", name: "Kakum National Park" },
      { id: "dest-2", name: "Cape Coast" },
    ]);
    db.enquiry.create.mockResolvedValue(
      enquiryRow({ tripId: "trip-9", startDate: new Date("2026-12-01T00:00:00.000Z") }) as never,
    );
    db.enquiry.findUnique.mockResolvedValue(enquiryRow({ tripId: "trip-9" }) as never);

    await service.create({ tripId: "trip-9" }, requester); // body has nothing else

    const call = db.enquiry.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data.tripId).toBe("trip-9");
    expect(call.data.startDate).toEqual(new Date("2026-12-01T00:00:00.000Z"));
    expect(call.data.endDate).toEqual(new Date("2026-12-04T00:00:00.000Z"));
    expect(call.data.adults).toBe(3);
    expect(call.data.children).toBe(1);
    expect(call.data.destinations).toEqual(["Kakum National Park", "Cape Coast"]);
    expect(call.data.interests).toEqual(["FOOD_CUISINE", "NATURE_WILDLIFE"]);
    expect(call.data.budgetRange).toBe("GHS 4,500 per person (incl. flights)");
  });

  it("rejects trip-linked capture from guests and non-owners", async () => {
    await expect(service.create({ tripId: "trip-9" })).rejects.toMatchObject({ status: 401 });

    db.trip.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ tripId: "trip-9" }, { id: "user-2", email: "r@example.com", name: "Rita" }),
    ).rejects.toMatchObject({ status: 404, code: "TRIP_NOT_FOUND" });
    expect(db.enquiry.create).not.toHaveBeenCalled();
  });
});

describe("EnquiriesService.update", () => {
  it("advances the pipeline through allowed states", async () => {
    db.enquiry.findUnique.mockResolvedValue({ id: "enq-1", status: "NEW", code: "ENQ-AB2CD3" });
    db.enquiry.update.mockResolvedValue(enquiryRow({ status: "IN_REVIEW" }) as never);

    const enquiry = await service.update("enq-1", { status: "IN_REVIEW" });

    expect(enquiry.status).toBe("IN_REVIEW");
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ENQUIRY_UPDATED", entityType: "Enquiry" }),
      }),
    );
  });

  it("refuses invalid transitions (NEW → CONVERTED skips the human review)", async () => {
    db.enquiry.findUnique.mockResolvedValue({ id: "enq-1", status: "NEW", code: "ENQ-AB2CD3" });

    await expect(service.update("enq-1", { status: "CONVERTED" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_STATUS_TRANSITION",
    });
    expect(db.enquiry.update).not.toHaveBeenCalled();
  });

  it("CLOSED is terminal", async () => {
    db.enquiry.findUnique.mockResolvedValue({ id: "enq-1", status: "CLOSED", code: "ENQ-AB2CD3" });

    await expect(service.update("enq-1", { status: "IN_REVIEW" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_STATUS_TRANSITION",
    });
  });

  it("assigns and clears the owning admin", async () => {
    db.enquiry.findUnique.mockResolvedValue({ id: "enq-1", status: "NEW", code: "ENQ-AB2CD3" });
    db.enquiry.update.mockResolvedValue(enquiryRow({ assignedAdminId: "admin-1" }) as never);

    await service.update("enq-1", { assignedAdminId: "admin-1" });
    let call = db.enquiry.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data.assignedAdminId).toBe("admin-1");

    vi.clearAllMocks();
    db.enquiry.findUnique.mockResolvedValue({ id: "enq-1", status: "NEW", code: "ENQ-AB2CD3" });
    db.enquiry.update.mockResolvedValue(enquiryRow({ assignedAdminId: null }) as never);
    await service.update("enq-1", { assignedAdminId: null });
    call = db.enquiry.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data.assignedAdminId).toBeNull();
  });
});

describe("EnquiriesService.list", () => {
  it("filters by status and searches name, email, code and phone", async () => {
    db.enquiry.findMany.mockResolvedValue([] as never);

    await service.list({ status: "NEW", q: "ama@example.com" });

    expect(db.enquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "NEW",
          OR: [
            { name: { contains: "ama@example.com", mode: "insensitive" } },
            { email: { contains: "ama@example.com", mode: "insensitive" } },
            { code: { contains: "ama@example.com", mode: "insensitive" } },
            { phone: { contains: "ama@example.com", mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});

describe("EnquiriesService.remove", () => {
  beforeEach(() => {
    db.auditLog.create.mockResolvedValue({});
    db.enquiry.delete.mockResolvedValue({});
  });

  it("deletes an enquiry and audits the cleanup, keeping the reference after the row is gone", async () => {
    db.enquiry.findUnique.mockResolvedValue(
      enquiryRow({ status: "CLOSED" }),
    );

    const result = await service.remove("admin-1", "enq-1");

    expect(result.message).toContain("ENQ-");
    expect(db.enquiry.delete).toHaveBeenCalledWith({ where: { id: "enq-1" } });
    const audit = db.auditLog.create.mock.calls[0]![0].data;
    expect(audit.action).toBe("ENQUIRY_DELETED");
    expect(audit.entityType).toBe("Enquiry");
    expect(audit.entityId).toBe("enq-1");
    expect(audit.actorUserId).toBe("admin-1");
    expect(audit.meta).toEqual({ code: "ENQ-AB2CD3", status: "CLOSED", email: "ama@example.com" });
  });

  it("404s on an unknown enquiry", async () => {
    db.enquiry.findUnique.mockResolvedValue(null);

    await expect(service.remove("admin-1", "enq-missing")).rejects.toMatchObject({
      status: 404,
      code: "ENQUIRY_NOT_FOUND",
    });
    expect(db.enquiry.delete).not.toHaveBeenCalled();
  });
});
