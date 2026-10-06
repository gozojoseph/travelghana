import { beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogService } from "./catalog.service";

const db = {
  tour: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  experience: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
};

const service = new CatalogService(db as never);

beforeEach(() => {
  vi.clearAllMocks();
  db.tour.findMany.mockResolvedValue([]);
  db.tour.count.mockResolvedValue(0);
  db.experience.findMany.mockResolvedValue([]);
  db.experience.count.mockResolvedValue(0);
});

describe("listTours", () => {
  it("only exposes published listings", async () => {
    await service.listTours({ page: 1, pageSize: 12 } as never);

    expect(db.tour.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ published: true }) }),
    );
    expect(db.tour.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ published: true }),
    });
  });

  it("searches title/description and filters by city slug", async () => {
    const q = "kakum";
    const city = "cape-coast";
    await service.listTours({ q, city, page: 1, pageSize: 12 } as never);

    const call = db.tour.findMany.mock.calls[0] as [Record<string, unknown>];
    const where = call[0].where as Record<string, unknown>;
    expect(where.OR).toEqual([
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ]);
    expect(where.city).toEqual({ is: { slug: city } });
  });

  it("paginates and computes pages", async () => {
    db.tour.count.mockResolvedValue(25);

    const result = await service.listTours({ page: 3, pageSize: 10 } as never);

    expect(db.tour.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
    expect(result).toMatchObject({ total: 25, page: 3, pageSize: 10, pages: 3 });
  });
});

describe("detail lookups", () => {
  it("finds a published tour by provider slug + tour slug", async () => {
    db.tour.findFirst.mockResolvedValue({ id: "t1", slug: "volta-cruise" });

    const tour = await service.getTour({
      providerSlug: "volta-cruises",
      listingSlug: "volta-cruise",
    });

    expect(tour.slug).toBe("volta-cruise");
    expect(db.tour.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: "volta-cruise",
          published: true,
          provider: { slug: "volta-cruises" },
        },
      }),
    );
  });

  it("404s when the tour is missing, unpublished, or provider-scoped wrong", async () => {
    db.tour.findFirst.mockResolvedValue(null);

    await expect(
      service.getTour({ providerSlug: "volta-cruises", listingSlug: "nope" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
