import { beforeEach, describe, expect, it, vi } from "vitest";

import { ListingBookingsService } from "./listing-bookings.service";

// PrismaService and the Mailer are mocked; the Postgres-backed behaviour
// (login-first, unpublished/non-transport listings 404) is exercised through
// the service guards here and by the live smoke check after each phase.
const db = {
  listing: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  listingBooking: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  notification: { create: vi.fn() },
};
const mailer = { send: vi.fn() };

const service = new ListingBookingsService(db as never, mailer);

const now = new Date("2026-11-02T00:00:00.000Z");

// Keep unit tests away from the developer's real ADMIN_EMAIL configuration.
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_EMAIL;
});

const LISTING_CONTEXT = {
  id: "lst-1",
  slug: "accra-airport-transfer",
  title: "Accra airport transfer",
  serviceArea: "Greater Accra",
  capacity: 4,
  durationMinutes: 45,
  provider: { id: "prov-1", slug: "kente-rides", name: "Kente Rides", type: "TRANSPORT_COMPANY" },
};

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    code: "TB-6H5MXN",
    userId: "user-1",
    listingId: "lst-1",
    startDate: now,
    partySize: 2,
    notes: "Flight lands 14:20, please meet at arrivals",
    status: "PENDING",
    quoteNote: null,
    quoteAt: null,
    decidedAt: null,
    createdAt: now,
    updatedAt: now,
    user: { id: "user-1", email: "traveler@example.com", name: "Ama" },
    listing: LISTING_CONTEXT,
    ...overrides,
  };
}

describe("ListingBookingsService.create", () => {
  const input = {
    listingId: "lst-1",
    startDate: new Date("2026-12-01T00:00:00.000Z"),
    partySize: 3,
    notes: "Flight lands 14:20, please meet at arrivals",
  };

  function arrangeCreated() {
    db.listing.findUnique.mockResolvedValue({
      id: "lst-1",
      status: "PUBLISHED",
      capacity: 4,
      provider: { type: "TRANSPORT_COMPANY" },
    });
    db.user.findUnique.mockResolvedValue({ email: "traveler@example.com", name: "Ama" });
    db.listingBooking.create.mockResolvedValue(requestRow());
  }

  it("records the request with a TB- code, audits it and emails a receipt", async () => {
    arrangeCreated();

    const dto = await service.create("user-1", input);

    expect(dto.code).toMatch(/^TB-[A-Z2-9]{6}$/);
    expect(dto.status).toBe("PENDING");
    expect(dto.listing.title).toBe("Accra airport transfer");
    expect(db.auditLog.create.mock.calls[0]![0].data.action).toBe("LISTING_REQUEST_SENT");
    expect(db.auditLog.create.mock.calls[0]![0].data.entityType).toBe("ListingBooking");
    expect(db.notification.create.mock.calls[0]![0].data).toMatchObject({
      userId: "user-1",
      channel: "EMAIL",
      type: "LISTING_REQUEST_SENT",
      payload: { requestId: "req-1", code: "TB-6H5MXN" },
      status: "QUEUED",
    });
    expect(mailer.send).toHaveBeenCalledTimes(1);
    const message = mailer.send.mock.calls[0]![0];
    expect(message.to).toBe("traveler@example.com");
    expect(message.subject).toContain("TB-6H5MXN");
    expect(message.text).toContain("Accra airport transfer");
    expect(message.text).toContain("Nothing is booked yet - the team will reply with a quote.");
  });

  it("rejects listings outside the transport surface", async () => {
    db.listing.findUnique.mockResolvedValue({
      id: "lst-1",
      status: "PUBLISHED",
      capacity: 4,
      provider: { type: "EXPERIENCE_PROVIDER" },
    });
    db.user.findUnique.mockResolvedValue({ email: "traveler@example.com", name: "Ama" });

    await expect(service.create("user-1", input)).rejects.toMatchObject({ status: 404 });
  });

  it("rejects drafts (unpublished listings)", async () => {
    db.listing.findUnique.mockResolvedValue({
      id: "lst-1",
      status: "DRAFT",
      capacity: 4,
      provider: { type: "TRANSPORT_COMPANY" },
    });

    await expect(service.create("user-1", input)).rejects.toMatchObject({ status: 404 });
  });

  it("rejects parties above the listing's seats", async () => {
    db.listing.findUnique.mockResolvedValue({
      id: "lst-1",
      status: "PUBLISHED",
      capacity: 2,
      provider: { type: "DRIVER_PARTNER" },
    });

    await expect(service.create("user-1", input)).rejects.toMatchObject({
      status: 409,
      code: "REQUEST_ABOVE_CAPACITY",
    });
  });

  it("still records the request when the user row cannot be read (no email then)", async () => {
    db.listing.findUnique.mockResolvedValue({
      id: "lst-1",
      status: "PUBLISHED",
      capacity: 4,
      provider: { type: "TRANSPORT_COMPANY" },
    });
    db.user.findUnique.mockResolvedValue(null);
    db.listingBooking.create.mockResolvedValue(requestRow());

    await service.create("user-1", input);

    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mailer.send).not.toHaveBeenCalled();
  });
});

describe("ListingBookingsService.quote", () => {
  it("sends the written quote, keeps it on the row and emails the traveler", async () => {
    db.listingBooking.findUnique.mockResolvedValue(requestRow());
    db.listingBooking.update.mockResolvedValue(
      requestRow({ quoteNote: "GHS 350 all-in, fuel and driver included.", quoteAt: now }),
    );

    const result = await service.quote("admin-1", "req-1", {
      message: "GHS 350 all-in, fuel and driver included.",
    });

    expect(result.message).toContain("TB-6H5MXN");
    expect(db.listingBooking.update.mock.calls[0]![0].data).toMatchObject({
      quoteNote: "GHS 350 all-in, fuel and driver included.",
    });
    expect(db.auditLog.create.mock.calls[0]![0].data.action).toBe("LISTING_REQUEST_QUOTED");
    const message = mailer.send.mock.calls[0]![0];
    expect(message.to).toBe("traveler@example.com");
    expect(message.text).toContain("GHS 350 all-in, fuel and driver included.");
  });

  it("refuses quotes once a request is decided", async () => {
    db.listingBooking.findUnique.mockResolvedValue(requestRow({ status: "CONFIRMED" }));

    await expect(service.quote("admin-1", "req-1", { message: "hello" })).rejects.toMatchObject({
      status: 409,
      code: "REQUEST_STATUS_IMMUTABLE",
    });
    expect(db.listingBooking.update).not.toHaveBeenCalled();
  });
});

describe("ListingBookingsService.decide", () => {
  it("confirms a pending request with decidedAt + audited notification + email", async () => {
    db.listingBooking.findUnique.mockResolvedValue(requestRow());
    db.listingBooking.update.mockResolvedValue(
      requestRow({ status: "CONFIRMED", decidedAt: now }),
    );

    const dto = await service.decide("admin-1", "req-1", { decision: "CONFIRMED" });

    expect(dto.status).toBe("CONFIRMED");
    expect(db.listingBooking.update.mock.calls[0]![0].data).toMatchObject({
      status: "CONFIRMED",
    });
    expect(db.auditLog.create.mock.calls[0]![0].data.action).toBe("LISTING_REQUEST_CONFIRMED");
    const message = mailer.send.mock.calls[0]![0];
    expect(message.subject).toContain("is confirmed");
  });

  it("cancels with the team message carried into the audit trail + email", async () => {
    db.listingBooking.findUnique.mockResolvedValue(requestRow());
    db.listingBooking.update.mockResolvedValue(
      requestRow({ status: "CANCELLED", decidedAt: now }),
    );

    await service.decide("admin-1", "req-1", {
      decision: "CANCELLED",
      message: "The vehicle is out on the 1st.",
    });

    expect(db.listingBooking.update.mock.calls[0]![0].data).toMatchObject({
      status: "CANCELLED",
    });
    const message = mailer.send.mock.calls[0]![0];
    expect(message.text).toContain("The vehicle is out on the 1st.");
  });

  it("refuses a second decision on an already-decided request", async () => {
    db.listingBooking.findUnique.mockResolvedValue(requestRow({ status: "CONFIRMED" }));

    await expect(
      service.decide("admin-1", "req-1", { decision: "CANCELLED" }),
    ).rejects.toMatchObject({ status: 409, code: "REQUEST_STATUS_IMMUTABLE" });
    expect(db.listingBooking.update).not.toHaveBeenCalled();
  });
});

describe("ListingBookingsService.remove", () => {
  it("deletes a quote conversation and audits what happened", async () => {
    db.listingBooking.findUnique.mockResolvedValue(requestRow());

    const result = await service.remove("admin-1", "req-1");

    expect(result.message).toContain("TB-6H5MXN");
    expect(db.listingBooking.delete).toHaveBeenCalledWith({ where: { id: "req-1" } });
    expect(db.auditLog.create.mock.calls[0]![0].data.action).toBe("LISTING_REQUEST_DELETED");
  });
});
