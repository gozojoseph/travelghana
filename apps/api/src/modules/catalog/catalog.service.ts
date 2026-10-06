import { Injectable, NotFoundException } from "@nestjs/common";
import type { Experience, Tour } from "@travelghana/database";
import type { CatalogListQuery, ProviderListingSlugParams } from "@travelghana/validation";

import { PrismaService } from "../../common/prisma.service";

/** Listings carry just the provider/city context the traveler UI needs. */
const TOUR_INCLUDE = {
  provider: { select: { name: true, slug: true, verificationStatus: true } },
  city: { select: { name: true, slug: true } },
} as const;

const EXPERIENCE_INCLUDE = {
  provider: { select: { name: true, slug: true, verificationStatus: true } },
  city: { select: { name: true, slug: true } },
} as const;

export interface CatalogListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

/** Shared free-text/keyword filter across tour + experience models. */
function textFilter(query: CatalogListQuery) {
  if (!query.q && !query.category) return {};
  return {
    OR: [
      ...(query.q
        ? [
            { title: { contains: query.q, mode: "insensitive" as const } },
            { description: { contains: query.q, mode: "insensitive" as const } },
          ]
        : []),
      ...(query.category
        ? [{ category: { equals: query.category, mode: "insensitive" as const } }]
        : []),
    ],
  };
}

/**
 * Public read model over published operator listings (§14: start simple).
 * Drafts are invisible here; detail routes are keyed by provider slug +
 * listing slug (slugs are unique per provider, not globally).
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listTours(query: CatalogListQuery): Promise<CatalogListResult<Tour>> {
    const where = {
      published: true,
      ...textFilter(query),
      ...(query.city ? { city: { is: { slug: query.city } } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tour.findMany({
        where,
        include: TOUR_INCLUDE,
        orderBy: [{ createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.tour.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async listExperiences(query: CatalogListQuery): Promise<CatalogListResult<Experience>> {
    const where = {
      published: true,
      ...textFilter(query),
      ...(query.city ? { city: { is: { slug: query.city } } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.experience.findMany({
        where,
        include: EXPERIENCE_INCLUDE,
        orderBy: [{ createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.experience.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async getTour(params: ProviderListingSlugParams): Promise<Tour> {
    const tour = await this.prisma.tour.findFirst({
      where: {
        slug: params.listingSlug,
        published: true,
        provider: { slug: params.providerSlug },
      },
      include: TOUR_INCLUDE,
    });
    if (!tour) throw new NotFoundException("Tour not found");
    return tour;
  }

  async getExperience(params: ProviderListingSlugParams): Promise<Experience> {
    const experience = await this.prisma.experience.findFirst({
      where: {
        slug: params.listingSlug,
        published: true,
        provider: { slug: params.providerSlug },
      },
      include: EXPERIENCE_INCLUDE,
    });
    if (!experience) throw new NotFoundException("Experience not found");
    return experience;
  }
}
