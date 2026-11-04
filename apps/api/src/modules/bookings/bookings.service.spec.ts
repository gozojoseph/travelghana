import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookingsService } from "./bookings.service";

// PrismaService and the Mailer are mocked here; the Postgres-backed behaviour
// (login-first, drafts 404, admin-only queue, the confirmation email being
// "sent") is covered by test/bookings.int.spec.ts.
const db = {
  package: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  packageDeparture: { findUnique: vi.fn(), count: vi.fn() },
  packageBooking: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  notification: { create: vi.fn() },
  siteSettings: { findUnique: vi.fn() },
};
const mailer = { send: vi.fn() };

const service = new BookingsService(db as never, mailer);

const now = new Date("2026-11-02T00:00:00.000Z");

// The admin-copy branch reads ADMIN_EMAIL from env; keep unit tests away from
// the developer's real configuration (integration covers the copy path).
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_EMAIL;
});

describe("BookingsService.create", () => {
  const input = {
    packageId: "pkg_cape_coast_0001",
    startDate: new Date("2026-12-01T00:00:00.000Z"),
    adults: 2,
    children: 1,
    notes: "Window seats, please",
  };

  function arrangeCreated() {
    db.package.findUnique.mockResolvedValue({ id: input.packageId, title: "Cape Coast Heritage", status: "PUBLISHED" });
    db.packageDeparture.count.mockResolvedValue(0);
    db.user.findUnique.mockResolvedValue({ email: "traveler@example.com", name: "Tayo" });
    db.packageBooking.create.mockResolvedValue({
      id: "pbk-1",
      code: "PB-6H5MXN",
      userId: "user-1",
      packageId: input.packageId,
      startDate: now,
      adults: 2,
      children: 1,
      notes: input.notes,
      status: "PENDING_PAYMENT",
      createdAt: now,
      updatedAt: now,
    });
  }

  it("books a published package, mints a code and audits the request", async () => {
    arrangeCreated();

    const dto = await service.create("user-1", input);

    expect(dto.code).toMatch(/^PB-[A-Z2-9]{6}$/);
    expect(dto.status).toBe("PENDING_PAYMENT");
    expect(db.auditLog.create.mock.calls[0]![0].data.action).toBe("PACKAGE_BOOKING_REQUESTED");
    expect(db.auditLog.create.mock.calls[0]![0].data.entityType).toBe("PackageBooking");
    expect(db.auditLog.create.mock.calls[0]![0].data.meta.packageId).toBe(input.packageId);
  });

  it("queues an in-app notification and emails the traveler a confirmation", async () => {
    arrangeCreated();

    await service.create("user-1", input);

    expect(db.notification.create.mock.calls[0]![0].data).toMatchObject({
      userId: "user-1",
      channel: "EMAIL",
      type: "PACKAGE_BOOKING_REQUESTED",
      payload: { bookingId: "pbk-1", code: "PB-6H5MXN" },
      status: "QUEUED",
    });
    expect(mailer.send).toHaveBeenCalledTimes(1);
    const message = mailer.send.mock.calls[0]![0];
    expect(message.to).toBe("traveler@example.com");
    expect(message.subject).toContain("PB-6H5MXN");
    expect(message.text).toContain("Cape Coast Heritage");
    expect(message.text).toContain("no payment has been taken");
  });

  it("still records the booking when the user row cannot be read (no email then)", async () => {
    db.package.findUnique.mockResolvedValue({ id: input.packageId, title: "Cape Coast Heritage", status: "PUBLISHED" });
    db.user.findUnique.mockResolvedValue(null);
    db.packageBooking.create.mockResolvedValue({
      id: "pbk-2",
      code: "PB-7H5MXN",
      userId: "user-1",
      packageId: input.packageId,
      startDate: now,
      adults: 2,
      children: 0,
      notes: null,
      status: "PENDING_PAYMENT",
      createdAt: now,
      updatedAt: now,
    });

    const dto = await service.create("user-1", input);

    expect(dto.code).toBe("PB-7H5MXN");
    expect(db.notification.create).toHaveBeenCalledTimes(1);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it("rejects booking an unpublished (draft) package", async () => {
    db.package.findUnique.mockResolvedValue({ id: input.packageId, title: "Draft", status: "DRAFT" });
    db.user.findUnique.mockResolvedValue({ email: "traveler@example.com", name: null });

    await expect(service.create("user-1", input)).rejects.toMatchObject({ status: 404 });
    expect(db.packageBooking.create).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it("rejects booking an unknown package", async () => {
    db.package.findUnique.mockResolvedValue(null);
    db.user.findUnique.mockResolvedValue({ email: "traveler@example.com", name: null });

    await expect(service.create("user-1", input)).rejects.toMatchObject({ status: 404 });
    expect(db.packageBooking.create).not.toHaveBeenCalled();
  });
});

describe("BookingsService.create with departures (D41)", () => {
  const pkgId = "pkg_cape_coast_0001";
  const past = new Date("2026-01-01T00:00:00.000Z");
  const depDate = new Date("2026-12-05T00:00:00.000Z");
  const departure = { id: "dep-1", packageId: pkgId, date: depDate, seats: 6 };

  function arrange(overrides: Partial<typeof departure> = {}) {
    db.package.findUnique.mockResolvedValue({ id: pkgId, title: "Cape Coast Heritage", status: "PUBLISHED" });
    db.user.findUnique.mockResolvedValue({ email: "traveler@example.com", name: "Tayo" });
    db.packageDeparture.findUnique.mockResolvedValue({ ...departure, ...overrides });
    db.packageDeparture.count.mockResolvedValue(1);
    db.packageBooking.create.mockResolvedValue({
      id: "pbk-dep",
      code: "PB-2H5MXN",
      userId: "user-1",
      packageId: pkgId,
      startDate: depDate,
      adults: 2,
      children: 1,
      notes: null,
      status: "PENDING_PAYMENT",
      createdAt: now,
      updatedAt: now,
    });
  }

  it("books against a chosen departure: start date is fixed and seats are held", async () => {
    // 6 seats, 3 already live -> party of 3 fits exactly.
    db.packageBooking.aggregate.mockResolvedValue({ _sum: { adults: 2, children: 1 } });
    arrange();

    const dto = await service.create("user-1", {
      packageId: pkgId,
      startDate: depDate,
      departureId: "dep-1",
      adults: 2,
      children: 1,
    });

    expect(dto.code).toMatch(/^PB-[A-Z2-9]{6}$/);
    const data = db.packageBooking.create.mock.calls[0]![0].data;
    expect(data.departureId).toBe("dep-1");
    expect(data.startDate).toBe(depDate);
    expect(db.packageBooking.aggregate).toHaveBeenCalledOnce();
  });

  it("rejects a departure that belongs to another package", async () => {
    db.packageBooking.aggregate.mockResolvedValue({ _sum: {} });
    arrange({ packageId: "pkg_other_000000" });

    await expect(
      service.create("user-1", {
        packageId: pkgId,
        startDate: depDate,
        departureId: "dep-1",
        adults: 1,
        children: 0,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.packageBooking.create).not.toHaveBeenCalled();
  });

  it("rejects a past departure", async () => {
    arrange({ date: past });

    await expect(
      service.create("user-1", {
        packageId: pkgId,
        startDate: past,
        departureId: "dep-1",
        adults: 1,
        children: 0,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.packageBooking.create).not.toHaveBeenCalled();
  });

  it("refuses when the party no longer fits the remaining seats", async () => {
    // 2 live adults already + a party of 10 > 6 seats.
    db.packageBooking.aggregate.mockResolvedValue({ _sum: { adults: 2, children: 0 } });
    arrange();

    await expect(
      service.create("user-1", {
        packageId: pkgId,
        startDate: depDate,
        departureId: "dep-1",
        adults: 10,
        children: 0,
      }),
    ).rejects.toMatchObject({ code: "DEPARTURE_FULL" });
    expect(db.packageBooking.create).not.toHaveBeenCalled();
  });

  it("refuses an open-dated request on a package that publishes departures", async () => {
    db.packageDeparture.findUnique.mockReset();
    db.packageDeparture.findUnique.mockResolvedValue(null);
    db.packageDeparture.count.mockResolvedValue(3);
    db.package.findUnique.mockResolvedValue({ id: pkgId, title: "Cape Coast Heritage", status: "PUBLISHED" });
    db.user.findUnique.mockResolvedValue({ email: "traveler@example.com", name: "Tayo" });

    await expect(
      service.create("user-1", { packageId: pkgId, startDate: depDate, adults: 2, children: 0 }),
    ).rejects.toMatchObject({ code: "DEPARTURE_REQUIRED" });
    expect(db.packageBooking.create).not.toHaveBeenCalled();
  });
});

describe("BookingsService.listMine", () => {
  it("returns only the traveler's bookings, newest first, with package context", async () => {
    db.packageBooking.count.mockResolvedValue(1);
    db.packageBooking.findMany.mockResolvedValue([
      {
        id: "pbk-1",
        code: "PB-6H5MXN",
        userId: "user-1",
        packageId: "pkg-1",
        startDate: now,
        adults: 2,
        children: 0,
        notes: null,
        status: "PENDING_PAYMENT",
        createdAt: now,
        updatedAt: now,
        package: {
          id: "pkg-1",
          slug: "cape-coast-heritage-coastline",
          title: "Cape Coast Heritage",
          priceMinor: 450000,
          currencyCode: "GHS",
        },
      },
    ]);

    const result = await service.listMine("user-1");

    const call = db.packageBooking.findMany.mock.calls[0]![0];
    expect(call.where).toEqual({ userId: "user-1" });
    expect(call.orderBy).toEqual({ createdAt: "desc" });
    expect(result.total).toBe(1);
    expect(result.items[0]!.package.title).toBe("Cape Coast Heritage");
    expect(result.items[0]!.package.currencyCode).toBe("GHS");
  });
});

describe("BookingsService.listAdmin", () => {
  it("filters by status when provided", async () => {
    db.packageBooking.count.mockResolvedValue(1);
    db.packageBooking.findMany.mockResolvedValue([
      {
        id: "pbk-1",
        code: "PB-6H5MXN",
        userId: "user-1",
        packageId: "pkg-1",
        startDate: now,
        adults: 2,
        children: 0,
        notes: null,
        status: "PENDING_PAYMENT",
        createdAt: now,
        updatedAt: now,
        user: { id: "user-1", email: "a@b.example", name: "Ada" },
        package: { id: "pkg-1", slug: "cape-coast", title: "Cape Coast Heritage", priceMinor: 450000 },
      },
    ]);

    const result = await service.listAdmin({ status: "PENDING_PAYMENT" });

    expect(db.packageBooking.findMany.mock.calls[0]![0].where).toEqual({ status: "PENDING_PAYMENT" });
    expect(db.packageBooking.findMany.mock.calls[0]![0].orderBy).toEqual({ createdAt: "desc" });
    expect(result.items[0]!.package.title).toBe("Cape Coast Heritage");
    expect(result.items[0]!.user.email).toBe("a@b.example");
  });
});

describe("BookingsService.remove", () => {
  const row = {
    id: "pbk-1",
    code: "PB-6H5MXN",
    status: "PENDING_PAYMENT",
    userId: "user-1",
    package: { title: "Cape Coast Heritage" },
  };

  beforeEach(() => {
    db.auditLog.create.mockResolvedValue({});
    db.packageBooking.delete.mockResolvedValue({});
  });

  it("deletes a pending request and audits the cleanup with the booking details", async () => {
    db.packageBooking.findUnique.mockResolvedValue(row);

    const result = await service.remove("admin-1", "pbk-1");

    expect(result.message).toContain("PB-6H5MXN");
    expect(db.packageBooking.delete).toHaveBeenCalledWith({ where: { id: "pbk-1" } });
    const audit = db.auditLog.create.mock.calls[0]![0].data;
    expect(audit.action).toBe("PACKAGE_BOOKING_DELETED");
    expect(audit.entityType).toBe("PackageBooking");
    expect(audit.entityId).toBe("pbk-1");
    expect(audit.actorUserId).toBe("admin-1");
    expect(audit.meta).toEqual({ code: "PB-6H5MXN", packageTitle: "Cape Coast Heritage", status: "PENDING_PAYMENT", userId: "user-1" });
  });

  it("refuses confirmed bookings - they are financial records", async () => {
    db.packageBooking.findUnique.mockResolvedValue({ ...row, status: "CONFIRMED" });

    await expect(service.remove("admin-1", "pbk-1")).rejects.toMatchObject({
      status: 409,
      code: "FINANCIAL_RECORD_IMMUTABLE",
    });
    expect(db.packageBooking.delete).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("404s on an unknown booking", async () => {
    db.packageBooking.findUnique.mockResolvedValue(null);

    await expect(service.remove("admin-1", "pbk-missing")).rejects.toMatchObject({
      status: 404,
      code: "BOOKING_NOT_FOUND",
    });
    expect(db.packageBooking.delete).not.toHaveBeenCalled();
  });
});

describe("BookingsService admin outreach and decisions (D36)", () => {
  /** Admin-view row from loadAdminView's select + include shape. */
  function arrangeView(status: string) {
    db.packageBooking.findUnique.mockResolvedValue({
      id: "pbk-1",
      code: "PB-6H5MXN",
      status,
      startDate: now,
      adults: 2,
      children: 1,
      userId: "user-1",
      package: { title: "Cape Coast Heritage" },
      user: { email: "traveler@example.com", name: "Tayo" },
    });
  }

  function arrangeDecisionUpdate() {
    db.packageBooking.update.mockResolvedValue({
      id: "pbk-1",
      code: "PB-6H5MXN",
      packageId: "pkg-1",
      startDate: now,
      adults: 2,
      children: 1,
      notes: null,
      status: "CONFIRMED",
      createdAt: now,
      updatedAt: now,
      user: { id: "user-1", email: "traveler@example.com", name: "Tayo" },
      package: { id: "pkg-1", slug: "cape-coast", title: "Cape Coast Heritage", priceMinor: 450000 },
    });
  }

  it("acknowledges with an email, audit and a notification - no status change", async () => {
    arrangeView("PENDING_PAYMENT");

    const result = await service.acknowledge("admin-1", "pbk-1", "We're on it.");

    expect(result.message).toContain("PB-6H5MXN");
    expect(mailer.send).toHaveBeenCalledTimes(1);
    const message = mailer.send.mock.calls[0]![0];
    expect(message.to).toBe("traveler@example.com");
    expect(message.subject).toContain("PB-6H5MXN");
    expect(message.subject).toContain("looking after");
    expect(message.text).toContain('A message from our team: "We\'re on it."');
    expect(message.html).toContain("Booking acknowledged");
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "PACKAGE_BOOKING_ACKNOWLEDGED" }) }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "PACKAGE_BOOKING_ACKNOWLEDGED" }) }),
    );
    expect(db.packageBooking.update).not.toHaveBeenCalled();
  });

  it("sends a concern with the team note quoted", async () => {
    arrangeView("PENDING_PAYMENT");

    await service.concern("admin-1", "pbk-1", "Does the carer travel with you?");

    const message = mailer.send.mock.calls[0]![0];
    expect(message.subject).toContain("A note from our team");
    expect(message.text).toContain('"Does the carer travel with you?"');
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "PACKAGE_BOOKING_CONCERN" }) }),
    );
  });

  it("confirms a payment-pending request and emails the decision", async () => {
    arrangeView("PENDING_PAYMENT");
    arrangeDecisionUpdate();

    const dto = await service.decide("admin-1", "pbk-1", { decision: "CONFIRMED" });

    expect(dto.status).toBe("CONFIRMED");
    expect(db.packageBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pbk-1" }, data: { status: "CONFIRMED" } }),
    );
    const message = mailer.send.mock.calls[0]![0];
    expect(message.subject).toContain("is confirmed");
    expect(message.text).toContain("Nothing has been charged yet");
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "PACKAGE_BOOKING_CONFIRMED" }) }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "PACKAGE_BOOKING_CONFIRMED" }) }),
    );
  });

  it("cancels with a reason and records the cancellation fields", async () => {
    arrangeView("PENDING_PAYMENT");
    db.packageBooking.update.mockResolvedValue({
      id: "pbk-1",
      code: "PB-6H5MXN",
      packageId: "pkg-1",
      startDate: now,
      adults: 2,
      children: 1,
      notes: null,
      status: "CANCELLED",
      createdAt: now,
      updatedAt: now,
      user: { id: "user-1", email: "traveler@example.com", name: "Tayo" },
      package: { id: "pkg-1", slug: "cape-coast", title: "Cape Coast Heritage", priceMinor: 450000 },
    });

    const dto = await service.decide("admin-1", "pbk-1", {
      decision: "CANCELLED",
      reason: "No vehicle left for that weekend",
    });

    expect(dto.status).toBe("CANCELLED");
    expect(db.packageBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pbk-1" },
        data: { status: "CANCELLED" },
      }),
    );
    // The reason survives in the notification + audit trail (no free-text
    // cancellation column on PackageBooking).
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "PACKAGE_BOOKING_CANCELLED",
          payload: expect.objectContaining({ reason: "No vehicle left for that weekend" }),
        }),
      }),
    );
    const message = mailer.send.mock.calls[0]![0];
    expect(message.subject).toContain("was cancelled");
    expect(message.text).toContain('Cancellation reason: "No vehicle left for that weekend"');
  });

  it("refuses decisions on anything but payment-pending (payment rails later)", async () => {
    arrangeView("CONFIRMED");

    await expect(
      service.decide("admin-1", "pbk-1", { decision: "CANCELLED", reason: "x" }),
    ).rejects.toMatchObject({
      status: 409,
      code: "BOOKING_STATUS_IMMUTABLE",
    });
    expect(db.packageBooking.update).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it("emails a copy of new requests to ADMIN_EMAIL when configured", async () => {
    db.package.findUnique.mockResolvedValue({ id: "p1", title: "Cape Coast Heritage", status: "PUBLISHED" });
    // No departures on this package: the open-dated path stays in play.
    db.packageDeparture.count.mockResolvedValue(0);
    db.user.findUnique.mockResolvedValue({ email: "traveler@example.com", name: "Tayo" });
    db.packageBooking.create.mockResolvedValue({
      id: "pbk-9",
      code: "PB-9HHH9H",
      userId: "user-1",
      packageId: "p1",
      startDate: now,
      adults: 1,
      children: 0,
      notes: null,
      status: "PENDING_PAYMENT",
      createdAt: now,
      updatedAt: now,
    });
    process.env.ADMIN_EMAIL = "owner@travelghana.test";

    await service.create("user-1", {
      packageId: "p1",
      startDate: now,
      adults: 1,
      children: 0,
      notes: null,
    });

    expect(mailer.send).toHaveBeenCalledTimes(2);
    const adminMessage = mailer.send.mock.calls[1]![0];
    expect(adminMessage.to).toBe("owner@travelghana.test");
    expect(adminMessage.subject).toContain("New booking request PB-9HHH9H");
    delete process.env.ADMIN_EMAIL;
  });
});

describe("Manual payments (D44)", () => {
  it("confirms with the settings payment instructions shown once, reference-only", async () => {
    db.packageBooking.findUnique.mockResolvedValue({
      id: "pbk-1",
      code: "PB-6H5MXN",
      status: "PENDING_PAYMENT",
      paidAt: null,
      startDate: now,
      adults: 2,
      children: 1,
      userId: "user-1",
      package: { title: "Cape Coast Heritage" },
      user: { email: "traveler@example.com", name: "Tayo" },
    });
    db.packageBooking.update.mockResolvedValue({
      id: "pbk-1",
      code: "PB-6H5MXN",
      packageId: "pkg-1",
      startDate: now,
      adults: 2,
      children: 1,
      notes: null,
      status: "CONFIRMED",
      paidAt: null,
      createdAt: now,
      updatedAt: now,
      user: { id: "user-1", email: "traveler@example.com", name: "Tayo" },
      package: { id: "pkg-1", slug: "cape-coast", title: "Cape Coast Heritage", priceMinor: 450000 },
    });
    db.siteSettings.findUnique.mockResolvedValue({
      momoInstructions: "Send to 055 123 4567 (MTN MoMo).",
      bankInstructions: "GCB TravelGhana Ltd - 1234567890123.",
    });

    await service.decide("admin-1", "pbk-1", { decision: "CONFIRMED" });

    expect(db.siteSettings.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "site" } }),
    );
    const message = mailer.send.mock.calls[0]![0];
    expect(message.text).toContain("Use your booking reference PB-6H5MXN");
    expect(message.text).toContain("Send to 055 123 4567 (MTN MoMo).");
    expect(message.text).toContain("GCB TravelGhana Ltd - 1234567890123.");
    expect(message.html).toContain("How to pay");
  });

  it("marks a confirmed booking as paid - paidAt, audit, notification, short email", async () => {
    db.packageBooking.findUnique.mockResolvedValue({
      id: "pbk-1",
      code: "PB-6H5MXN",
      status: "CONFIRMED",
      paidAt: null,
      startDate: now,
      adults: 2,
      children: 1,
      userId: "user-1",
      package: { title: "Cape Coast Heritage" },
      user: { email: "traveler@example.com", name: "Tayo" },
    });
    db.packageBooking.update.mockResolvedValue({
      id: "pbk-1",
      code: "PB-6H5MXN",
      packageId: "pkg-1",
      startDate: now,
      adults: 2,
      children: 1,
      notes: null,
      status: "CONFIRMED",
      paidAt: now,
      createdAt: now,
      updatedAt: now,
      user: { id: "user-1", email: "traveler@example.com", name: "Tayo" },
      package: { id: "pkg-1", slug: "cape-coast", title: "Cape Coast Heritage", priceMinor: 450000 },
    });

    const dto = await service.markPaid("admin-1", "pbk-1");

    expect(dto.paidAt).toBe(now.toISOString());
    expect(dto.status).toBe("CONFIRMED");
    expect(db.packageBooking.update.mock.calls[0]![0].data).toMatchObject({ paidAt: expect.anything() });
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "PACKAGE_BOOKING_PAID" }) }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "PACKAGE_BOOKING_PAID" }) }),
    );
    const message = mailer.send.mock.calls[0]![0];
    expect(message.to).toBe("traveler@example.com");
    expect(message.subject).toContain("Payment received for your TravelGhana booking (PB-6H5MXN)");
    expect(message.text).toContain("You are all set");
  });

  it("refuses marking a payment-pending booking as paid", async () => {
    db.packageBooking.findUnique.mockResolvedValue({
      id: "pbk-1",
      code: "PB-6H5MXN",
      status: "PENDING_PAYMENT",
      paidAt: null,
      startDate: now,
      adults: 2,
      children: 1,
      userId: "user-1",
      package: { title: "Cape Coast Heritage" },
      user: { email: "traveler@example.com", name: "Tayo" },
    });

    await expect(service.markPaid("admin-1", "pbk-1")).rejects.toMatchObject({
      status: 409,
      code: "BOOKING_NOT_CONFIRMED",
    });
    expect(db.packageBooking.update).not.toHaveBeenCalled();
  });

  it("refuses marking a booking paid twice", async () => {
    db.packageBooking.findUnique.mockResolvedValue({
      id: "pbk-1",
      code: "PB-6H5MXN",
      status: "CONFIRMED",
      paidAt: now,
      startDate: now,
      adults: 2,
      children: 1,
      userId: "user-1",
      package: { title: "Cape Coast Heritage" },
      user: { email: "traveler@example.com", name: "Tayo" },
    });

    await expect(service.markPaid("admin-1", "pbk-1")).rejects.toMatchObject({
      status: 409,
      code: "BOOKING_ALREADY_PAID",
    });
    expect(db.packageBooking.update).not.toHaveBeenCalled();
  });
});
