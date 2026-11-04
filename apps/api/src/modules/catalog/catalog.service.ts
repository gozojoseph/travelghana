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

const ATTRACTION_INCLUDE = {
  destination: { select: { slug: true, name: true } },
  city: {
    select: { slug: true, name: true, region: { select: { slug: true, name: true } } },
  },
} as const;

/** Provider types whose listings belong in the transport request flow (D43). */
const TRANSPORT_PROVIDER_TYPES: ("TRANSPORT_COMPANY" | "DRIVER_PARTNER")[] = [
  "TRANSPORT_COMPANY",
  "DRIVER_PARTNER",
];

/**
 * Transport listing rows (D43) carry the provider + city context for the
 * traveler UI. Prices are excluded on purpose - requests are quote-based.
 */
const TRANSPORT_LISTING_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  serviceArea: true,
  capacity: true,
  durationMinutes: true,
  category: true,
  heroImageUrl: true,
  publishedAt: true,
  provider: {
    select: { name: true, slug: true, verificationStatus: true, type: true },
  },
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

  /**
   * Transport listing discovery (D43). Only published listings from transport
   * providers (transport companies + driver partners) surface here, because
   * request-a-quote booking is transport/rides-only per the owner survey.
   * Price fields are deliberately NOT selected: quoting happens in the
   * conversation, not from a fixed rate.
   */
  async listTransportListings(query: CatalogListQuery) {
    const where = {
      status: "PUBLISHED" as const,
      provider: { type: { in: TRANSPORT_PROVIDER_TYPES } },
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" as const } },
              { description: { contains: query.q, mode: "insensitive" as const } },
              { serviceArea: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      // Listing carries cityId without a relation, so the transport browse
      // supports free text + page params only (no city slug filter).
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        select: TRANSPORT_LISTING_SELECT,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async getTransportListing(params: ProviderListingSlugParams) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        slug: params.listingSlug,
        status: "PUBLISHED" as const,
        provider: {
          slug: params.providerSlug,
          type: { in: TRANSPORT_PROVIDER_TYPES },
        },
      },
      select: {
        ...TRANSPORT_LISTING_SELECT,
        requirements: true,
        whatIsIncluded: true,
        address: true,
        meetingPoint: true,
      },
    });
    if (!listing) throw new NotFoundException("Transport listing not found");
    return listing;
  }

  /**
   * Public attractions index (D18 discovery). D20 adds an unpublish flag so
   * editors can pull a row out of public view without deleting it; rows are
   * filtered by free text, category and city slug.
   */
  async listAttractions(query: CatalogListQuery) {
    const where = {
      published: true,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" as const } },
              { description: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.category
        ? { category: { equals: query.category, mode: "insensitive" as const } }
        : {}),
      ...(query.city ? { city: { is: { slug: query.city } } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.attraction.findMany({
        where,
        include: ATTRACTION_INCLUDE,
        orderBy: [{ name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.attraction.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }
}
