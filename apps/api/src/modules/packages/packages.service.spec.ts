import { beforeEach, describe, expect, it, vi } from "vitest";

import { PackagesService } from "./packages.service";

// PrismaService is mocked here; the Postgres-backed behaviour is covered by
// test/packages.int.spec.ts.
const db = {
  package: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  destination: {
    findUnique: vi.fn(),
  },
};

const service = new PackagesService(db as never);

const now = new Date("2026-10-19T12:00:00.000Z");
const destination = {
  id: "dest-1",
  slug: "cape-coast",
  name: "Cape Coast",
  city: { name: "Cape Coast", region: { name: "Central" } },
};

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pkg-1",
    slug: "cape-coast-heritage",
    title: "Cape Coast heritage",
    summary: null,
    description: null,
    destinationId: "dest-1",
    durationDays: 3,
    durationNights: 2,
    priceMinor: 250_000,
    currencyCode: "GHS",
    heroImageUrl: null,
    inclusions: null,
    exclusions: null,
    status: "DRAFT",
    featured: false,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    destination,
    days: [],
    _count: { days: 0 },
    ...overrides,
  };
}

const createInput = {
  title: "Cape Coast Heritage",
  destinationId: "dest-1",
  durationDays: 3,
  durationNights: 2,
  priceMinor: 250_000,
  currencyCode: "GHS",
  days: [{ dayNumber: 1, title: "Arrive in Cape Coast" }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PackagesService.create", () => {
  it("generates a unique slug, starts as DRAFT and creates the outline", async () => {
    db.destination.findUnique.mockResolvedValue({ id: "dest-1" });
    db.package.findUnique
      .mockResolvedValueOnce({ id: "taken" })
      .mockResolvedValueOnce(null);
    db.package.create.mockResolvedValue(
      detailRow({ slug: "cape-coast-heritage-2" }),
    );

    const result = await service.create(createInput);

    expect(result.slug).toBe("cape-coast-heritage-2");
    expect(db.package.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "cape-coast-heritage-2",
          status: "DRAFT",
          days: {
            create: [
              expect.objectContaining({
                dayNumber: 1,
                title: "Arrive in Cape Coast",
              }),
            ],
          },
        }),
      }),
    );
  });

  it("rejects an unknown destination before writing", async () => {
    db.destination.findUnique.mockResolvedValue(null);

    await expect(service.create(createInput)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_DESTINATION",
    });
    expect(db.package.create).not.toHaveBeenCalled();
  });

  it("rejects nights that are not fewer than days", async () => {
    db.destination.findUnique.mockResolvedValue({ id: "dest-1" });

    await expect(
      service.create({ ...createInput, durationNights: 3 }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_DURATION" });
  });

  it("rejects duplicate day numbers", async () => {
    db.destination.findUnique.mockResolvedValue({ id: "dest-1" });

    await expect(
      service.create({
        ...createInput,
        days: [
          { dayNumber: 1, title: "One" },
          { dayNumber: 1, title: "Again" },
        ],
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_DAYS" });
  });
});

describe("PackagesService.get / delete", () => {
  it("returns 404 for a missing package", async () => {
    db.package.findUnique.mockResolvedValue(null);

    await expect(service.get("missing")).rejects.toMatchObject({ status: 404 });
  });

  it("returns 404 when deleting a missing package", async () => {
    db.package.findUnique.mockResolvedValue(null);

    await expect(service.delete("missing")).rejects.toMatchObject({ status: 404 });
    expect(db.package.delete).not.toHaveBeenCalled();
  });
});

describe("PackagesService.update", () => {
  it("publishes and replaces the day outline as a set", async () => {
    db.package.findUnique.mockResolvedValue(detailRow());
    db.package.update.mockResolvedValue(
      detailRow({
        status: "PUBLISHED",
        publishedAt: now,
        days: [{ id: "day-1", dayNumber: 1, title: "New outline", description: null, meals: null, accommodation: null }],
        _count: { days: 1 },
      }),
    );

    const result = await service.update("pkg-1", {
      status: "PUBLISHED",
      days: [{ dayNumber: 1, title: "New outline" }],
    });

    expect(result.status).toBe("PUBLISHED");
    expect(result.publishedAt).toBe(now.toISOString());
    expect(db.package.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PUBLISHED",
          publishedAt: expect.any(Date),
          days: {
            deleteMany: {},
            create: [expect.objectContaining({ dayNumber: 1, title: "New outline" })],
          },
        }),
      }),
    );
  });

  it("clears publishedAt when the package leaves PUBLISHED", async () => {
    db.package.findUnique.mockResolvedValue(
      detailRow({ status: "PUBLISHED", publishedAt: now }),
    );
    db.package.update.mockResolvedValue(detailRow({ status: "DRAFT" }));

    await service.update("pkg-1", { status: "DRAFT" });

    expect(db.package.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT", publishedAt: null }),
      }),
    );
  });

  it("validates duration against the stored values on a partial update", async () => {
    db.package.findUnique.mockResolvedValue(detailRow({ durationDays: 3 }));

    await expect(
      service.update("pkg-1", { durationNights: 3 }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_DURATION" });
    expect(db.package.update).not.toHaveBeenCalled();
  });

  it("can clear a destination", async () => {
    db.package.findUnique.mockResolvedValue(detailRow());
    db.package.update.mockResolvedValue(
      detailRow({ destination: null, destinationId: null }),
    );

    await service.update("pkg-1", { destinationId: null });

    expect(db.package.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ destination: { disconnect: true } }),
      }),
    );
  });
});

describe("PackagesService public catalog", () => {
  it("lists only published packages, featured first", async () => {
    db.package.findMany.mockResolvedValue([
      detailRow({ status: "PUBLISHED", featured: true, publishedAt: now }),
    ]);

    const items = await service.listPublished();

    expect(db.package.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED" },
        orderBy: [
          { featured: "desc" },
          { publishedAt: "desc" },
          { updatedAt: "desc" },
        ],
      }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe("PUBLISHED");
  });

  it("returns a published package by slug", async () => {
    db.package.findFirst.mockResolvedValue(detailRow({ status: "PUBLISHED" }));

    const pkg = await service.getPublishedBySlug("cape-coast-heritage");

    expect(db.package.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "cape-coast-heritage", status: "PUBLISHED" },
      }),
    );
    expect(pkg.slug).toBe("cape-coast-heritage");
  });

  it("returns 404 for drafts and unknown slugs", async () => {
    db.package.findFirst.mockResolvedValue(null);

    await expect(service.getPublishedBySlug("draft-only")).rejects.toMatchObject({
      status: 404,
    });
  });
});
