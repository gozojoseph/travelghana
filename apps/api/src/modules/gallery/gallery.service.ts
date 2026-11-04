import { Injectable } from "@nestjs/common";
import type { Prisma } from "@travelghana/database";
import type { GalleryItem } from "@travelghana/types";
import type {
  GalleryItemCreateInput,
  GalleryItemListQuery,
  GalleryItemUpdateInput,
} from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";

type GalleryItemRow = Prisma.GalleryItemGetPayload<Record<string, never>>;

/** Empty optional strings are stored as NULL; undefined means "leave alone". */
function nullableText(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value.trim() === "" ? null : value;
}

/**
 * Admin-managed public gallery.
 *
 * Images are URL-based editorial content (no upload pipeline yet). Drafts are
 * invisible on the public surface; publishing is a simple boolean toggle.
 */
@Injectable()
export class GalleryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin list with search and a draft/published filter. */
  async list(query: GalleryItemListQuery): Promise<GalleryItem[]> {
    const where: Prisma.GalleryItemWhereInput = {};

    if (query.status === "PUBLISHED") where.published = true;
    if (query.status === "DRAFT") where.published = false;
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { caption: { contains: query.q, mode: "insensitive" } },
        { category: { contains: query.q, mode: "insensitive" } },
        { location: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const rows = await this.prisma.galleryItem.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      take: 500,
    });

    return rows.map((row) => this.toDto(row));
  }

  /** Public gallery: published items only, curated order first. */
  async listPublished(): Promise<GalleryItem[]> {
    const rows = await this.prisma.galleryItem.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    return rows.map((row) => this.toDto(row));
  }

  async get(id: string): Promise<GalleryItem> {
    const row = await this.prisma.galleryItem.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound("Gallery item not found");
    return this.toDto(row);
  }

  async create(input: GalleryItemCreateInput): Promise<GalleryItem> {
    const row = await this.prisma.galleryItem.create({
      data: {
        title: input.title,
        caption: nullableText(input.caption) ?? null,
        imageUrl: input.imageUrl,
        category: nullableText(input.category) ?? null,
        location: nullableText(input.location) ?? null,
        sortOrder: input.sortOrder ?? 0,
        published: input.published ?? false,
      },
    });

    return this.toDto(row);
  }

  async update(id: string, input: GalleryItemUpdateInput): Promise<GalleryItem> {
    const existing = await this.prisma.galleryItem.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw ApiError.notFound("Gallery item not found");

    const data: Prisma.GalleryItemUpdateInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.published !== undefined) data.published = input.published;

    const caption = nullableText(input.caption);
    if (caption !== undefined) data.caption = caption;
    const category = nullableText(input.category);
    if (category !== undefined) data.category = category;
    const location = nullableText(input.location);
    if (location !== undefined) data.location = location;

    const row = await this.prisma.galleryItem.update({ where: { id }, data });
    return this.toDto(row);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.galleryItem.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw ApiError.notFound("Gallery item not found");
    await this.prisma.galleryItem.delete({ where: { id } });
  }

  private toDto(row: GalleryItemRow): GalleryItem {
    return {
      id: row.id,
      title: row.title,
      caption: row.caption,
      imageUrl: row.imageUrl,
      category: row.category,
      location: row.location,
      sortOrder: row.sortOrder,
      published: row.published,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
