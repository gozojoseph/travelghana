import { beforeEach, describe, expect, it, vi } from "vitest";

import { GalleryService } from "./gallery.service";

// PrismaService is mocked here; the Postgres-backed behaviour is covered by
// test/gallery.int.spec.ts.
const db = {
  galleryItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

const service = new GalleryService(db as never);

const now = new Date("2026-10-19T12:00:00.000Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "gal-1",
    title: "Independence Arch",
    caption: "Morning light over Accra",
    imageUrl: "https://example.com/arch.jpg",
    category: "Cities",
    location: "Accra, Greater Accra",
    sortOrder: 1,
    published: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GalleryService.list", () => {
  it("filters by status and searches title, caption, category and location", async () => {
    db.galleryItem.findMany.mockResolvedValue([row({ published: true })]);

    const items = await service.list({ q: "accra", status: "PUBLISHED" });

    expect(db.galleryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          published: true,
          OR: [
            { title: { contains: "accra", mode: "insensitive" } },
            { caption: { contains: "accra", mode: "insensitive" } },
            { category: { contains: "accra", mode: "insensitive" } },
            { location: { contains: "accra", mode: "insensitive" } },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.published).toBe(true);
  });

  it("filters drafts with status=DRAFT", async () => {
    db.galleryItem.findMany.mockResolvedValue([]);

    await service.list({ status: "DRAFT" });

    expect(db.galleryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { published: false } }),
    );
  });
});

describe("GalleryService.listPublished", () => {
  it("lists only published items in curated order", async () => {
    db.galleryItem.findMany.mockResolvedValue([row({ published: true })]);

    const items = await service.listPublished();

    expect(db.galleryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { published: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
    );
    expect(items[0]?.id).toBe("gal-1");
  });
});

describe("GalleryService.create", () => {
  it("defaults to draft, sort order zero and stores empty optionals as null", async () => {
    db.galleryItem.create.mockResolvedValue(
      row({ caption: null, category: null, location: null, sortOrder: 0 }),
    );

    await service.create({
      title: "Independence Arch",
      imageUrl: "https://example.com/arch.jpg",
      caption: "  ",
      category: "",
      location: "",
    });

    expect(db.galleryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Independence Arch",
        imageUrl: "https://example.com/arch.jpg",
        caption: null,
        category: null,
        location: null,
        sortOrder: 0,
        published: false,
      }),
    });
  });
});

describe("GalleryService.get / delete", () => {
  it("returns 404 for a missing item", async () => {
    db.galleryItem.findUnique.mockResolvedValue(null);

    await expect(service.get("missing")).rejects.toMatchObject({ status: 404 });
  });

  it("returns 404 when deleting a missing item", async () => {
    db.galleryItem.findUnique.mockResolvedValue(null);

    await expect(service.delete("missing")).rejects.toMatchObject({ status: 404 });
    expect(db.galleryItem.delete).not.toHaveBeenCalled();
  });

  it("deletes an existing item", async () => {
    db.galleryItem.findUnique.mockResolvedValue({ id: "gal-1" });
    db.galleryItem.delete.mockResolvedValue(row());

    await service.delete("gal-1");

    expect(db.galleryItem.delete).toHaveBeenCalledWith({ where: { id: "gal-1" } });
  });
});

describe("GalleryService.update", () => {
  it("publishes and clears an optional caption", async () => {
    db.galleryItem.findUnique.mockResolvedValue({ id: "gal-1" });
    db.galleryItem.update.mockResolvedValue(
      row({ published: true, caption: null, sortOrder: 4 }),
    );

    const updated = await service.update("gal-1", {
      caption: "",
      published: true,
      sortOrder: 4,
    });

    expect(updated.published).toBe(true);
    expect(db.galleryItem.update).toHaveBeenCalledWith({
      where: { id: "gal-1" },
      data: { caption: null, published: true, sortOrder: 4 },
    });
  });

  it("returns 404 without writing when the item is missing", async () => {
    db.galleryItem.findUnique.mockResolvedValue(null);

    await expect(
      service.update("missing", { published: true }),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.galleryItem.update).not.toHaveBeenCalled();
  });
});
