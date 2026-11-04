import { Injectable } from "@nestjs/common";
import { Prisma } from "@travelghana/database";
import type {
  AdminCatalogResult,
  AttractionAdminDto,
  CatalogMutationResult,
  CityOption,
  DestinationAdminDto,
} from "@travelghana/types";
import type {
  AttractionAdminCreateInput,
  AttractionAdminQuery,
  AttractionAdminUpdateInput,
  DestinationAdminCreateInput,
  DestinationAdminQuery,
  DestinationAdminUpdateInput,
} from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";

const DESTINATION_INCLUDE = {
  city: { select: { name: true, region: { select: { name: true } } } },
} as const;

const ATTRACTION_INCLUDE = {
  destination: { select: { name: true } },
  city: { select: { name: true } },
} as const;

type DestinationRow = Prisma.DestinationGetPayload<{ include: typeof DESTINATION_INCLUDE }>;
type AttractionRow = Prisma.AttractionGetPayload<{ include: typeof ATTRACTION_INCLUDE }>;

/** Only slug collisions map to a 409; every other failure rethrows. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Kebab-case slug derivation for catalog names ("Cape Coast Castle" → "cape-coast-castle"). */
function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    throw ApiError.badRequest(
      "Could not derive a slug from this name — provide a slug explicitly",
      "INVALID_SLUG",
    );
  }
  return slug;
}

/**
 * Catalog admin (D20 Phase 6): CRUD for destinations and attractions, plus the
 * read-only city selector both forms use. Delete is guarded — rows referenced
 * by packages, trip itinerary items or (for destinations) attractions are
 * refused with a count so the admin can unpublish instead of breaking trips.
 */
@Injectable()
export class CatalogAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Destinations ────────────────────────────────────────────────────

  async listDestinations(query: DestinationAdminQuery): Promise<AdminCatalogResult<DestinationAdminDto>> {
    const where: Prisma.DestinationWhereInput = {
      ...(query.published ? { published: query.published === "true" } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { summary: { contains: query.q, mode: "insensitive" } },
              { city: { name: { contains: query.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.destination.findMany({
        where,
        include: DESTINATION_INCLUDE,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.destination.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toDestinationDto(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async getDestination(id: string): Promise<{ item: DestinationAdminDto }> {
    const row = await this.prisma.destination.findUnique({
      where: { id },
      include: DESTINATION_INCLUDE,
    });
    if (!row) throw ApiError.notFound("Destination not found");
    const [packages, itineraryItems, attractions] = await Promise.all([
      this.prisma.package.count({ where: { destinationId: id } }),
      this.prisma.itineraryItem.count({ where: { destinationId: id } }),
      this.prisma.attraction.count({ where: { destinationId: id } }),
    ]);
    return {
      item: {
        ...this.toDestinationDto(row),
        refCounts: { packages, itineraryItems, attractions },
      },
    };
  }

  async createDestination(
    adminId: string,
    input: DestinationAdminCreateInput,
  ): Promise<CatalogMutationResult<DestinationAdminDto>> {
    const slug = input.slug ?? slugifyName(input.name);
    let row;
    try {
      row = await this.prisma.destination.create({
        data: {
          cityId: input.cityId,
          name: input.name,
          slug,
          category: input.category,
          summary: input.summary,
          description: input.description,
          lat: input.lat,
          lng: input.lng,
          heroImageUrl: input.heroImageUrl,
          featured: input.featured ?? false,
          published: input.published ?? false,
        },
        include: DESTINATION_INCLUDE,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict(
          "A destination with this slug already exists",
          "DUPLICATE_SLUG",
        );
      }
      throw error;
    }
    await this.auditCatalogMutation(adminId, "DESTINATION_CREATED", row.id, {
      name: row.name,
      slug,
    });
    return { item: this.toDestinationDto(row), message: `Destination “${row.name}” created` };
  }

  async updateDestination(
    adminId: string,
    id: string,
    input: DestinationAdminUpdateInput,
  ): Promise<CatalogMutationResult<DestinationAdminDto>> {
    const existing = await this.prisma.destination.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Destination not found");

    let row;
    try {
      row = await this.prisma.destination.update({
        where: { id },
        data: { ...input, slug: input.slug ?? undefined },
        include: DESTINATION_INCLUDE,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict(
          "A destination with this slug already exists",
          "DUPLICATE_SLUG",
        );
      }
      throw error;
    }
    await this.auditCatalogMutation(
      adminId,
      "DESTINATION_UPDATED",
      id,
      { fields: Object.keys(input) },
    );
    return { item: this.toDestinationDto(row), message: "Destination updated" };
  }

  async deleteDestination(adminId: string, id: string): Promise<{ message: string }> {
    const row = await this.prisma.destination.findUnique({
      where: { id },
      select: { name: true },
    });
    if (!row) throw ApiError.notFound("Destination not found");

    // Delete is a hard break for anything pointing here (FKs are SetNull,
    // which would silently open holes in saved trips). Refuse and steer the
    // admin to unpublish instead — the copy in the UI repeats this policy.
    const [packages, itineraryItems, attractions] = await Promise.all([
      this.prisma.package.count({ where: { destinationId: id } }),
      this.prisma.itineraryItem.count({ where: { destinationId: id } }),
      this.prisma.attraction.count({ where: { destinationId: id } }),
    ]);
    if (packages > 0 || itineraryItems > 0 || attractions > 0) {
      throw ApiError.conflict(
        `This destination is referenced by ${packages} package(s), ${itineraryItems} itinerary item(s) and ${attractions} attraction(s) — unpublish it instead of deleting`,
        "REFERENCED_BY_CONTENT",
      );
    }

    await this.prisma.destination.delete({ where: { id } });
    await this.auditCatalogMutation(adminId, "DESTINATION_DELETED", id, { name: row.name });
    return { message: `Destination “${row.name}” deleted` };
  }

  // ── Attractions ─────────────────────────────────────────────────────

  async listAttractions(query: AttractionAdminQuery): Promise<AdminCatalogResult<AttractionAdminDto>> {
    const where: Prisma.AttractionWhereInput = {
      ...(query.published ? { published: query.published === "true" } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { description: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.attraction.findMany({
        where,
        include: ATTRACTION_INCLUDE,
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.attraction.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toAttractionDto(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async getAttraction(id: string): Promise<{ item: AttractionAdminDto }> {
    const row = await this.prisma.attraction.findUnique({
      where: { id },
      include: ATTRACTION_INCLUDE,
    });
    if (!row) throw ApiError.notFound("Attraction not found");
    const itineraryItems = await this.prisma.itineraryItem.count({
      where: { attractionId: id },
    });
    return {
      item: {
        ...this.toAttractionDto(row),
        refCounts: { itineraryItems },
      },
    };
  }

  async createAttraction(
    adminId: string,
    input: AttractionAdminCreateInput,
  ): Promise<CatalogMutationResult<AttractionAdminDto>> {
    const slug = input.slug ?? slugifyName(input.name);
    let row;
    try {
      row = await this.prisma.attraction.create({
        data: {
          destinationId: input.destinationId,
          cityId: input.cityId,
          name: input.name,
          slug,
          description: input.description,
          category: input.category,
          lat: input.lat,
          lng: input.lng,
          published: input.published ?? true,
        },
        include: ATTRACTION_INCLUDE,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict(
          "An attraction with this slug already exists",
          "DUPLICATE_SLUG",
        );
      }
      throw error;
    }
    await this.auditCatalogMutation(adminId, "ATTRACTION_CREATED", row.id, {
      name: row.name,
      slug,
    });
    return { item: this.toAttractionDto(row), message: `Attraction “${row.name}” created` };
  }

  async updateAttraction(
    adminId: string,
    id: string,
    input: AttractionAdminUpdateInput,
  ): Promise<CatalogMutationResult<AttractionAdminDto>> {
    const existing = await this.prisma.attraction.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Attraction not found");

    let row;
    try {
      row = await this.prisma.attraction.update({
        where: { id },
        data: { ...input, slug: input.slug ?? undefined },
        include: ATTRACTION_INCLUDE,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict(
          "An attraction with this slug already exists",
          "DUPLICATE_SLUG",
        );
      }
      throw error;
    }
    await this.auditCatalogMutation(adminId, "ATTRACTION_UPDATED", id, {
      fields: Object.keys(input),
    });
    return { item: this.toAttractionDto(row), message: "Attraction updated" };
  }

  async deleteAttraction(adminId: string, id: string): Promise<{ message: string }> {
    const row = await this.prisma.attraction.findUnique({
      where: { id },
      select: { name: true },
    });
    if (!row) throw ApiError.notFound("Attraction not found");

    const itineraryItems = await this.prisma.itineraryItem.count({
      where: { attractionId: id },
    });
    if (itineraryItems > 0) {
      throw ApiError.conflict(
        `This attraction is referenced by ${itineraryItems} itinerary item(s) — unpublish it instead of deleting`,
        "REFERENCED_BY_TRIPS",
      );
    }

    await this.prisma.attraction.delete({ where: { id } });
    await this.auditCatalogMutation(adminId, "ATTRACTION_DELETED", id, { name: row.name });
    return { message: `Attraction “${row.name}” deleted` };
  }

  // ── Read-only city selector (both forms) ────────────────────────────

  async listCities(): Promise<{ items: CityOption[] }> {
    const rows = await this.prisma.city.findMany({
      select: {
        id: true,
        name: true,
        regionId: true,
        region: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: 1000,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        regionId: row.regionId,
        regionName: row.region.name,
      })),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private toDestinationDto(row: DestinationRow): DestinationAdminDto {
    return {
      id: row.id,
      cityId: row.cityId,
      cityName: row.city?.name ?? null,
      regionName: row.city?.region?.name ?? null,
      name: row.name,
      slug: row.slug,
      category: row.category,
      summary: row.summary,
      description: row.description,
      lat: row.lat,
      lng: row.lng,
      heroImageUrl: row.heroImageUrl,
      featured: row.featured,
      published: row.published,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toAttractionDto(row: AttractionRow): AttractionAdminDto {
    return {
      id: row.id,
      destinationId: row.destinationId,
      destinationName: row.destination?.name ?? null,
      cityId: row.cityId,
      cityName: row.city?.name ?? null,
      name: row.name,
      slug: row.slug,
      description: row.description,
      category: row.category,
      lat: row.lat,
      lng: row.lng,
      published: row.published,
    };
  }

  private async auditCatalogMutation(
    actorUserId: string,
    action: string,
    entityId: string,
    meta: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { actorUserId, action, entityType: action.startsWith("ATTRACTION") ? "Attraction" : "Destination", entityId, meta },
    });
  }
}
