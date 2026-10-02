import { Injectable } from "@nestjs/common";
import type {
  Destination,
  DestinationCategory,
  Prisma,
} from "@travelghana/database";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";
import type { DestinationListQuery } from "@travelghana/validation";

export interface DestinationListResult {
  items: Destination[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

@Injectable()
export class DestinationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: DestinationListQuery): Promise<DestinationListResult> {
    const where: Prisma.DestinationWhereInput = { published: true };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { summary: { contains: query.q, mode: "insensitive" } },
        { city: { name: { contains: query.q, mode: "insensitive" } } },
      ];
    }
    if (query.city || query.region) {
      where.city = {
        ...(query.city ? { slug: query.city } : {}),
        ...(query.region ? { region: { slug: query.region } } : {}),
      };
    }
    if (query.category) {
      where.category = query.category as DestinationCategory;
    }
    if (query.featured) {
      where.featured = query.featured === "true";
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.destination.findMany({
        where,
        include: { city: { include: { region: true } } },
        orderBy: [{ featured: "desc" }, { name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.destination.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async getBySlug(slug: string): Promise<Destination> {
    const destination = await this.prisma.destination.findUnique({
      where: { slug },
      include: {
        city: { include: { region: true } },
        attractions: { orderBy: { name: "asc" } },
      },
    });
    if (!destination || !destination.published) {
      throw ApiError.notFound("Destination not found", "DESTINATION_NOT_FOUND");
    }
    return destination;
  }

  listRegions() {
    return this.prisma.region.findMany({
      orderBy: { sort: "asc" },
      include: { cities: { orderBy: { name: "asc" } } },
    });
  }

  listCities(regionSlug?: string) {
    return this.prisma.city.findMany({
      where: regionSlug ? { region: { slug: regionSlug } } : undefined,
      orderBy: { name: "asc" },
      include: { region: true },
    });
  }
}
