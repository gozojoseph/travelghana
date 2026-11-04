import { beforeEach, describe, expect, it, vi } from "vitest";

import { PackageReviewsService } from "./reviews.service";

// PrismaService is mocked here; the moderation queue's screens and the
// confirmed-booking gate behind real sessions are verified by the owner
// against the preview, like every admin surface so far (no admin password
// lives in the repo).
const db = {
  package: { findUnique: vi.fn() },
  packageBooking: { findFirst: vi.fn() },
  packageReview: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn() },
};

const service = new PackageReviewsService(db as never);

const now = new Date("2026-11-02T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PackageReviewsService.eligibility", () => {
  it("is eligible only with a CONFIRMED booking for that package", async () => {
    db.packageBooking.findFirst.mockResolvedValue({ id: "pbk-1" });
    db.packageReview.findFirst.mockResolvedValue(null);

    const dto = await service.eligibility("user-1", { packageId: "pkg-1" });

    expect(dto).toEqual({ eligible: true, existing: null });
    expect(db.packageBooking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", packageId: "pkg-1", status: "CONFIRMED" }),
      }),
    );
  });

  it("reports an existing review (any status) so the form cannot dupe", async () => {
    db.packageBooking.findFirst.mockResolvedValue({ id: "pbk-1" });
    db.packageReview.findFirst.mockResolvedValue({ id: "rev-1", status: "PENDING" });

    const dto = await service.eligibility("user-1", { packageId: "pkg-1" });

    expect(dto.existing).toEqual({ id: "rev-1", status: "PENDING" });
  });

  it("is not eligible without a confirmed booking", async () => {
    db.packageBooking.findFirst.mockResolvedValue(null);
    db.packageReview.findFirst.mockResolvedValue(null);

    const dto = await service.eligibility("user-1", { packageId: "pkg-1" });

    expect(dto).toEqual({ eligible: false, existing: null });
  });
});

describe("PackageReviewsService.createForUser", () => {
  const input = { packageId: "pkg-1", rating: 5, body: "A well-paced week." };

  it("lands a PENDING review on the confirmed booking and audits it", async () => {
    db.package.findUnique.mockResolvedValue({ id: "pkg-1" });
    db.packageBooking.findFirst.mockResolvedValue({ id: "pbk-9" });
    db.packageReview.findFirst.mockResolvedValue(null);
    db.packageReview.create.mockResolvedValue({ id: "rev-9", status: "PENDING" });

    const result = await service.createForUser("user-1", input);

    expect(result.status).toBe("PENDING");
    expect(db.packageReview.create).toHaveBeenCalledWith({
      data: {
        bookingId: "pbk-9",
        packageId: "pkg-1",
        userId: "user-1",
        rating: 5,
        body: "A well-paced week.",
        status: "PENDING",
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "REVIEW_SUBMITTED", entityId: "rev-9" }),
      }),
    );
  });

  it("refuses travelers without a confirmed booking on that package", async () => {
    db.package.findUnique.mockResolvedValue({ id: "pkg-1" });
    db.packageBooking.findFirst.mockResolvedValue(null);

    await expect(service.createForUser("user-1", input)).rejects.toMatchObject({
      status: 403,
      code: "REVIEW_NOT_UNLOCKED",
    });
    expect(db.packageReview.create).not.toHaveBeenCalled();
  });

  it("refuses a second review of the same package by the same traveler", async () => {
    db.package.findUnique.mockResolvedValue({ id: "pkg-1" });
    db.packageBooking.findFirst.mockResolvedValue({ id: "pbk-9" });
    db.packageReview.findFirst.mockResolvedValue({ id: "rev-1" });

    await expect(service.createForUser("user-1", input)).rejects.toMatchObject({
      status: 409,
      code: "REVIEW_ALREADY_SUBMITTED",
    });
    expect(db.packageReview.create).not.toHaveBeenCalled();
  });

  it("404s on an unknown package", async () => {
    db.package.findUnique.mockResolvedValue(null);

    await expect(service.createForUser("user-1", input)).rejects.toMatchObject({ status: 404 });
  });
});

describe("PackageReviewsService.listPublic", () => {
  it("returns approved reviews with a rounded average and name fallback", async () => {
    db.package.findUnique.mockResolvedValue({ id: "pkg-1" });
    db.packageReview.findMany.mockResolvedValue([
      {
        id: "rev-2",
        rating: 5,
        body: "Wonderful.",
        createdAt: now,
        author: { name: null },
      },
      {
        id: "rev-3",
        rating: 4,
        body: null,
        createdAt: now,
        author: { name: "Ama Mensah" },
      },
    ]);
    db.packageReview.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 2 } });

    const result = await service.listPublic({ packageSlug: "cape-coast-heritage" });

    expect(result.summary).toEqual({ average: 4.5, count: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.authorName).toBe("Traveler");
    expect(result.items[1]!.authorName).toBe("Ama Mensah");
    expect(result.items[1]!.body).toBeNull();
    // Emails never go public: the query selects the name only.
    expect(db.packageReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { author: { select: { name: true } } },
      }),
    );
  });

  it("shows nothing (null average) while nothing is approved", async () => {
    db.package.findUnique.mockResolvedValue({ id: "pkg-1" });
    db.packageReview.findMany.mockResolvedValue([]);
    db.packageReview.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } });

    const result = await service.listPublic({ packageSlug: "cape-coast-heritage" });

    expect(result).toEqual({ items: [], summary: { average: null, count: 0 } });
  });
});

describe("PackageReviewsService.admin moderation", () => {
  it("approves a pending review and audits the decision", async () => {
    db.packageReview.findUnique.mockResolvedValue({ id: "rev-9", status: "PENDING", bookingId: "pbk-9", rating: 5 });
    db.packageReview.update.mockResolvedValue({
      id: "rev-9",
      rating: 5,
      body: "Wonderful.",
      status: "APPROVED",
      decisionNote: null,
      createdAt: now,
      author: { id: "user-1", name: "Tayo", email: "traveler@example.com" },
      booking: { id: "pbk-9", code: "PB-2H5MXN", status: "CONFIRMED", startDate: now },
      package: { id: "pkg-1", slug: "cape-coast-heritage", title: "Cape Coast Heritage" },
    });

    const result = await service.approve("admin-1", "rev-9");

    expect(result.review.status).toBe("APPROVED");
    expect(db.packageReview.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "rev-9" }, data: { status: "APPROVED", decisionNote: null } }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "REVIEW_APPROVED", actorUserId: "admin-1" }),
      }),
    );
  });

  it("rejects with the required reason stored and audited", async () => {
    db.packageReview.findUnique.mockResolvedValue({ id: "rev-9", status: "PENDING", bookingId: "pbk-9", rating: 3 });
    db.packageReview.update.mockResolvedValue({
      id: "rev-9",
      rating: 3,
      body: "Meh.",
      status: "REJECTED",
      decisionNote: "Unrelated to the journey itself",
      createdAt: now,
      author: { id: "user-1", name: null, email: "traveler@example.com" },
      booking: { id: "pbk-9", code: "PB-2H5MXN", status: "CONFIRMED", startDate: now },
      package: { id: "pkg-1", slug: "cape-coast-heritage", title: "Cape Coast Heritage" },
    });

    const result = await service.reject("admin-1", "rev-9", "Unrelated to the journey itself");

    expect(result.review.status).toBe("REJECTED");
    expect(result.review.decisionNote).toBe("Unrelated to the journey itself");
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "REVIEW_REJECTED",
          meta: expect.objectContaining({ reason: "Unrelated to the journey itself" }),
        }),
      }),
    );
  });

  it("refuses to re-decide a review that is not pending anymore", async () => {
    db.packageReview.findUnique.mockResolvedValue({ id: "rev-9", status: "APPROVED", bookingId: "pbk-9", rating: 5 });

    await expect(service.approve("admin-1", "rev-9")).rejects.toMatchObject({
      status: 409,
      code: "REVIEW_STATUS_IMMUTABLE",
    });
    expect(db.packageReview.update).not.toHaveBeenCalled();
  });

  it("404s decisions on unknown reviews", async () => {
    db.packageReview.findUnique.mockResolvedValue(null);

    await expect(service.reject("admin-1", "rev-x", "No review here")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("PackageReviewsService.listAdmin", () => {
  it("filters the queue by status and counts the bucket", async () => {
    db.packageReview.findMany.mockResolvedValue([]);
    db.packageReview.count.mockResolvedValue(3);

    const result = await service.listAdmin({ status: "PENDING" });

    expect(result).toEqual({ items: [], total: 3 });
    expect(db.packageReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PENDING" } }),
    );
    expect(db.packageReview.count).toHaveBeenCalledWith({ where: { status: "PENDING" } });
  });

  it("lists all buckets when no status filter is passed", async () => {
    db.packageReview.findMany.mockResolvedValue([]);
    db.packageReview.count.mockResolvedValue(0);

    await service.listAdmin({});

    expect(db.packageReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});
