import { Injectable, NotFoundException } from "@nestjs/common";
import type { City, Listing, Provider, Region } from "@travelghana/database";
import { ListingStatus } from "@travelghana/database";
import {
  type ListingCreateInput,
  type ListingStatusInput,
  type ListingUpdateInput,
  type ReviewActionInput,
} from "@travelghana/validation";
import { PrismaService } from "../../common/prisma.service";

/** Summary returned to the provider dashboard and admin queue (no raw Listing). */
export interface ListingSummaryDto {
  id: string;
  slug: string;
  title: string;
  status: ListingStatus;
  providerId: string;
  providerName: string;
  cityName: string | null;
  citySlug: string | null;
  regionName: string | null;
  regionSlug: string | null;
  durationMinutes: number | null;
  capacity: number;
  priceMinor: number;
  currencyCode: string;
  publishedAt: Date | null;
  createdAt: Date;
}

/**
 * String literal union accepted by transitionStatus; mirrors the query
 * parameter shape but for the status *value* (not the zod body shape).
 */
export type ListingStatusString =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "PAUSED"
  | "ARCHIVED";

/**
 * Subset of the generated Listing scalar row returned by every Prisma query
 * (city/region resolved separately; a single Listing row is never returned).
 */
export type ListingRow = {
  id: string;
  slug: string;
  title: string;
  status: ListingStatus;
  providerId: string;
  provider: { name: string };
  cityId: string | null;
  regionId: string | null;
  description: string | null;
  serviceArea: string | null;
  durationMinutes: number | null;
  capacity: number;
  priceMinor: number;
  currencyCode: string;
  coordinatesLat: number | null;
  coordinatesLng: number | null;
  address: string | null;
  meetingPoint: string | null;
  category: string | null;
  whatIsIncluded: string | null;
  whatIsExcluded: string | null;
  requirements: string | null;
  cancellationPolicy: string | null;
  heroImageUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Reusable listings: provider dashboard (own rows) + admin review queue.
 *
 * Listing lifecycle: DRAFT -> PENDING_REVIEW -> (admin: PUBLISHED | DRAFT | PAUSED)
 * -> ARCHIVED.
 *
 * State machine:
 *   DRAFT       : owned by provider only; provider can transition to PENDING_REVIEW.
 *   PENDING_REVIEW : published for public browsing while under internal review.
 *   PUBLISHED   : public; payer can book; admin can SUSPEND -> PAUSED.
 *   PAUSED      : not public, still owned by provider and editable.
 *   ARCHIVED    : not public, retained for audit, never returned by a queue.
 *
 * Publicly browsable = PUBLISHED only.
 */
@Injectable()
export class ListingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Provider dashboard ────────────────────────────────────────────────────

  async listMyListings(
    userId: string,
    statusFilter?: ListingStatus | "PENDING_REVIEW",
  ): Promise<ListingSummaryDto[]> {
    const provider = await this.ownProvider(userId);
    const where: Record<string, unknown> = { providerId: provider.id };
    if (statusFilter !== undefined) {
      where.status = statusFilter;
    }

    // The generated listing payload returns the full scalar set (category,
    // description, serviceArea, meetingPoint, coordinatesLat/Lng, ...). Select
    // every scalar and resolve city/region names with two targeted lookups
    // instead of an include (postgres-level join not exposed). Do not return
    // the raw Listing here: the DTO is scalar-only, so the full row is mapped
    // by toSummaryWithResolvedLocations below.
    const items: ListingRow[] = await this.prisma.listing.findMany({
      where,
      orderBy: { status: "asc" as const, createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        providerId: true,
        provider: { select: { name: true } },
        cityId: true,
        regionId: true,
        description: true,
        serviceArea: true,
        durationMinutes: true,
        capacity: true,
        priceMinor: true,
        currencyCode: true,
        coordinatesLat: true,
        coordinatesLng: true,
        address: true,
        meetingPoint: true,
        category: true,
        whatIsIncluded: true,
        whatIsExcluded: true,
        requirements: true,
        cancellationPolicy: true,
        heroImageUrl: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
      },
      skip: 0,
      take: 200,
    });

    const cityById = new Map<string, { name: string; slug: string } | null>();
    const regionById = new Map<string, { name: string; slug: string } | null>();

    for (const item of items) {
      cityById.set(item.cityId ?? "__none__", null);
      regionById.set(item.regionId ?? "__none__", null);
    }

    const cityIds = [...new Set(items.map((i) => i.cityId))].filter(
      (id): id is string => id !== "__none__",
    );
    if (cityIds.length > 0) {
      const cities = await this.prisma.city.findMany({
        where: { id: { in: cityIds } },
        select: { id: true, name: true, slug: true },
      });
      for (const c of cities) cityById.set(c.id, c);
    }

    const regionIds = [...new Set(items.map((i) => i.regionId))].filter(
      (id): id is string => id !== "__none__",
    );
    if (regionIds.length > 0) {
      const regions = await this.prisma.region.findMany({
        where: { id: { in: regionIds } },
        select: { id: true, name: true, slug: true },
      });
      for (const r of regions) regionById.set(r.id, r);
    }

    return items.map((item) =>
      this.toSummaryWithResolvedLocations(
        item,
        cityById.get(item.cityId ?? "__none__") ?? null,
        regionById.get(item.regionId ?? "__none__") ?? null,
      ),
    );
  }

  async listMyListingsByStatus(
    userId: string,
    status: ListingStatusInput,
  ): Promise<ListingSummaryDto[]> {
    // `status` is the zod body shape (ListingStatusInput); read the
    // validated status *string* and cast to the enum-union param type.
    return this.listMyListings(userId, status.status as ListingStatusString | "PENDING_REVIEW");
  }

    async getMyListing(userId: string, listingId: string): Promise<ListingSummaryDto> {
    const provider = await this.ownProvider(userId);
    const listing: ListingRow | null = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        providerId: true,
        provider: { select: { name: true } },
        cityId: true,
        regionId: true,
        description: true,
        serviceArea: true,
        durationMinutes: true,
        capacity: true,
        priceMinor: true,
        currencyCode: true,
        coordinatesLat: true,
        coordinatesLng: true,
        address: true,
        meetingPoint: true,
        category: true,
        whatIsIncluded: true,
        whatIsExcluded: true,
        requirements: true,
        cancellationPolicy: true,
        heroImageUrl: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    if (!listing || listing.providerId !== provider.id) {
      // Same answer for missing vs. not yours: no existence oracle.
      throw new NotFoundException("Listing not found");
    }
    return this.toSummaryWithResolvedLocations(
      listing!,
      null,
      null,
    );
  }

  async createListing(userId: string, input: ListingCreateInput): Promise<ListingSummaryDto> {
    const provider = await this.ownProvider(userId);

    // Resolve optional location refs (city/region) and fall back to provider context.
    const city = input.cityId ? await this.ensureLocation(input.cityId, "cityId") : null;
    const region = input.regionId
      ? await this.ensureLocation(input.regionId, "regionId")
      : null;

    const slug = await this.uniqueListingSlug(input.title, (slug) =>
      this.prisma.listing.findFirst({
        where: { providerId: provider.id, slug },
        select: { id: true },
      }),
    );

    const listing = await this.prisma.listing.create({
      data: {
        providerId: provider.id,
        slug,
        title: input.title,
        description: input.description,
        serviceArea: input.serviceArea,
        durationMinutes: input.durationMinutes,
        capacity: input.capacity,
        priceMinor: input.priceMinor,
        currencyCode: input.currencyCode,
        cityId: city?.id ?? null,
        regionId: region?.id ?? null,
        coordinatesLat: input.coordinatesLat ?? null,
        coordinatesLng: input.coordinatesLng ?? null,
        address: input.address,
        meetingPoint: input.meetingPoint,
        category: input.category,
        whatIsIncluded: input.whatIsIncluded,
        whatIsExcluded: input.whatIsExcluded,
        requirements: input.requirements,
        cancellationPolicy: input.cancellationPolicy,
        heroImageUrl: input.heroImageUrl,
        status: input.published ? ListingStatus.PUBLISHED : ListingStatus.DRAFT,
        publishedAt: input.published ? new Date() : null,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        providerId: true,
        provider: { select: { name: true } },
        cityId: true,
        regionId: true,
        description: true,
        serviceArea: true,
        durationMinutes: true,
        capacity: true,
        priceMinor: true,
        currencyCode: true,
        coordinatesLat: true,
        coordinatesLng: true,
        address: true,
        meetingPoint: true,
        category: true,
        whatIsIncluded: true,
        whatIsExcluded: true,
        requirements: true,
        cancellationPolicy: true,
        heroImageUrl: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return this.toSummaryWithResolvedLocations(
      listing,
      null,
      null,
    );
  }

  async updateListing(userId: string, listingId: string, input: ListingUpdateInput): Promise<ListingSummaryDto> {
    const provider = await this.ownProvider(userId);
    const listing = await this.getMyListing(userId, listingId);

    const updates: Record<string, unknown> = {
      title: input.title,
      description: input.description,
      serviceArea: input.serviceArea,
      durationMinutes: input.durationMinutes,
      capacity: input.capacity,
      priceMinor: input.priceMinor,
      currencyCode: input.currencyCode,
      cityId: input.cityId ?? null,
      regionId: input.regionId ?? null,
      coordinatesLat: input.coordinatesLat ?? null,
      coordinatesLng: input.coordinatesLng ?? null,
      address: input.address,
      meetingPoint: input.meetingPoint,
      category: input.category,
      whatIsIncluded: input.whatIsIncluded,
      whatIsExcluded: input.whatIsExcluded,
      requirements: input.requirements,
      cancellationPolicy: input.cancellationPolicy,
      heroImageUrl: input.heroImageUrl,
    };

    if (input.published !== undefined) {
      updates.status = input.published ? ListingStatus.PUBLISHED : ListingStatus.DRAFT;
      updates.publishedAt = input.published ? new Date() : null;
    }

    // Re-derive slug only when the title changed.
    if (input.title !== undefined) {
      const slug = await this.uniqueListingSlug(input.title, (slug) =>
        this.prisma.listing.findFirst({
          where: { providerId: provider.id, slug, NOT: { id: listing.id } },
          select: { id: true },
        }),
      );
      updates.slug = slug;
    }

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data: updates,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        providerId: true,
        provider: { select: { name: true } },
        cityId: true,
        regionId: true,
        description: true,
        serviceArea: true,
        durationMinutes: true,
        capacity: true,
        priceMinor: true,
        currencyCode: true,
        coordinatesLat: true,
        coordinatesLng: true,
        address: true,
        meetingPoint: true,
        category: true,
        whatIsIncluded: true,
        whatIsExcluded: true,
        requirements: true,
        cancellationPolicy: true,
        heroImageUrl: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return this.toSummaryWithResolvedLocations(
      updated,
      null,
      null,
    );
  }

  async deleteListing(userId: string, listingId: string): Promise<void> {
    const provider = await this.ownProvider(userId);
    const listing = await this.getMyListing(userId, listingId);
    await this.prisma.listing.delete({ where: { id: listing.id } });
  }

  // ─── Status lifecycle (provider) ───────────────────────────────────────────

  async transitionStatus(
    userId: string,
    listingId: string,
    status: ListingStatusString,
  ): Promise<ListingSummaryDto> {
    // `status` arrives as the validated string union; cast to the enum
    // for the Prisma update layer. Runtime values always match ListingStatus.
    const requested = status as ListingStatus;
    const adminStatus = status as ListingStatus;
    const provider = await this.ownProvider(userId);
    const listing = await this.getMyListing(userId, listingId);

    // A provider can only move a DRAFT into review. Every other transition is
    // gated by the admin review actions below (or by the provider deleting the
    // row, which is the only "unpublish" path at this increment).
    if (requested === "PENDING_REVIEW" && (listing.status as ListingStatus) === ListingStatus.DRAFT) {
    const updated: ListingRow = await this.prisma.listing.update({
      where: { id: listing.id },      data: { status: requested, publishedAt: new Date() },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        providerId: true,
        provider: { select: { name: true } },
        cityId: true,
        regionId: true,
        description: true,
        serviceArea: true,
        durationMinutes: true,
        capacity: true,
        priceMinor: true,
        currencyCode: true,
        coordinatesLat: true,
        coordinatesLng: true,
        address: true,
        meetingPoint: true,
        category: true,
        whatIsIncluded: true,
        whatIsExcluded: true,
        requirements: true,
        cancellationPolicy: true,
        heroImageUrl: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return this.toSummaryWithResolvedLocations(
        updated,
        null,
        null,
      );
    }

    // The remaining transitions are admin-only. `status` is typed as
    // `ListingStatusInput` (a string union) while `listing.status` is the
    // Prisma enum `ListingStatus`. Narrow with `as` casts here; the DB
    // enforces the enum values at runtime, and these guards are developer
    // checks, not type assertions.
    if (adminStatus === "PUBLISHED" && (listing.status as ListingStatus) !== ListingStatus.PENDING_REVIEW) {
      throw new Error("Only a PENDING_REVIEW listing can be published by admin review.");
    }
    if (adminStatus === "ARCHIVED" && (listing.status as ListingStatus) === ListingStatus.PUBLISHED) {
      throw new Error("Switching to ARCHIVED must go through the admin review queue.");
    }
    if (adminStatus === "DRAFT" && (listing.status as ListingStatus) !== ListingStatus.PENDING_REVIEW) {
      throw new Error("A PENDING_REVIEW listing can only be rejected back to DRAFT.");
    }
    if (adminStatus === "PAUSED" && (listing.status as ListingStatus) !== ListingStatus.PUBLISHED) {
      throw new Error("PAUSED is only reachable from PUBLISHED via SUSPEND.");
    }

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      // `status` is the validated string union; cast to the enum so the DB
      // update layer accepts it. Runtime values always match ListingStatus.
      data: { status: requested },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        providerId: true,
        provider: { select: { name: true } },
        cityId: true,
        regionId: true,
        description: true,
        serviceArea: true,
        durationMinutes: true,
        capacity: true,
        priceMinor: true,
        currencyCode: true,
        coordinatesLat: true,
        coordinatesLng: true,
        address: true,
        meetingPoint: true,
        category: true,
        whatIsIncluded: true,
        whatIsExcluded: true,
        requirements: true,
        cancellationPolicy: true,
        heroImageUrl: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return this.toSummaryWithResolvedLocations(
      updated,
      null,
      null,
    );
  }

  // ─── Admin review queue ────────────────────────────────────────────────────

  async listAdminListings(statusFilter?: ListingStatusInput | "ALL"): Promise<ListingSummaryDto[]> {
    const where: Record<string, unknown> = {};
    if (statusFilter !== undefined) {
      where.status = statusFilter === "ALL" ? undefined : statusFilter;
    }
    const items: ListingRow[] = await this.prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        providerId: true,
        provider: { select: { name: true } },
        cityId: true,
        regionId: true,
        description: true,
        serviceArea: true,
        durationMinutes: true,
        capacity: true,
        priceMinor: true,
        currencyCode: true,
        coordinatesLat: true,
        coordinatesLng: true,
        address: true,
        meetingPoint: true,
        category: true,
        whatIsIncluded: true,
        whatIsExcluded: true,
        requirements: true,
        cancellationPolicy: true,
        heroImageUrl: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
      },
      skip: 0,
      take: 200,
    });

    const cityById = new Map<string, { name: string; slug: string } | null>();
    const regionById = new Map<string, { name: string; slug: string } | null>();

    for (const item of items) {
      cityById.set(item.cityId ?? "__none__", null);
      regionById.set(item.regionId ?? "__none__", null);
    }

    const cityIds = [...new Set(items.map((i) => i.cityId))].filter(
      (id): id is string => id !== "__none__",
    );
    if (cityIds.length > 0) {
      const cities = await this.prisma.city.findMany({
        where: { id: { in: cityIds } },
        select: { id: true, name: true, slug: true },
      });
      for (const c of cities) cityById.set(c.id, c);
    }

    const regionIds = [...new Set(items.map((i) => i.regionId))].filter(
      (id): id is string => id !== "__none__",
    );
    if (regionIds.length > 0) {
      const regions = await this.prisma.region.findMany({
        where: { id: { in: regionIds } },
        select: { id: true, name: true, slug: true },
      });
      for (const r of regions) regionById.set(r.id, r);
    }

    return items.map((item) =>
      this.toSummaryWithResolvedLocations(
        item,
        null,
        null,
      ),
    );
  }

  async reviewListing(listingId: string, action: ReviewActionInput): Promise<ListingSummaryDto> {
    const listing: ListingRow | null = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, slug: true, title: true, status: true, providerId: true, provider: { select: { name: true } }, cityId: true, regionId: true, description: true, serviceArea: true, durationMinutes: true, capacity: true, priceMinor: true, currencyCode: true, coordinatesLat: true, coordinatesLng: true, address: true, meetingPoint: true, category: true, whatIsIncluded: true, whatIsExcluded: true, requirements: true, cancellationPolicy: true, heroImageUrl: true, publishedAt: true, updatedAt: true, createdAt: true } });
    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.status !== ListingStatus.PENDING_REVIEW) {
      throw new Error("Only a PENDING_REVIEW listing can be reviewed.");
    }

    let status: ListingStatus;
    switch (action.reviewStatus) {
      case "APPROVE":
        status = ListingStatus.PUBLISHED;
        break;
      case "REJECT":
        status = ListingStatus.DRAFT;
        break;
      case "SUSPEND":
        status = ListingStatus.PAUSED;
        break;
    }

    const adminStatus = status as ListingStatus;

    const updated: ListingRow = await this.prisma.listing.update({
      where: { id: listing.id },
      data: { status: adminStatus, publishedAt: action.reviewStatus === "APPROVE" ? new Date() : null },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        providerId: true,
        provider: { select: { name: true } },
        cityId: true,
        regionId: true,
        description: true,
        serviceArea: true,
        durationMinutes: true,
        capacity: true,
        priceMinor: true,
        currencyCode: true,
        coordinatesLat: true,
        coordinatesLng: true,
        address: true,
        meetingPoint: true,
        category: true,
        whatIsIncluded: true,
        whatIsExcluded: true,
        requirements: true,
        cancellationPolicy: true,
        heroImageUrl: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return this.toSummaryWithResolvedLocations(
      updated,
      null,
      null,
    );
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private toSummary(listing: ListingRow): ListingSummaryDto {
    return this.toSummaryWithResolvedLocations(listing, null, null);
  }

  private toSummaryWithResolvedLocations(
    item: ListingRow,
    city: { name: string; slug: string } | null,
    region: { name: string; slug: string } | null,
  ): ListingSummaryDto {
    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      status: item.status,
      providerId: item.providerId,
      providerName: item.provider.name,
      cityName: city?.name ?? null,
      citySlug: city?.slug ?? null,
      regionName: region?.name ?? null,
      regionSlug: region?.slug ?? null,
      durationMinutes: item.durationMinutes,
      capacity: item.capacity,
      priceMinor: item.priceMinor,
      currencyCode: item.currencyCode,
      publishedAt: item.publishedAt,
      createdAt: item.createdAt,
    };
  }

  private async ownProvider(userId: string): Promise<Provider> {
    const provider = await this.prisma.provider.findUnique({ where: { userId } });
    if (!provider) throw new NotFoundException("Provider not found");
    return provider;
  }

  private async ensureLocation(ref: string, field: "cityId" | "regionId"): Promise<City | Region> {
    const exists = await this.prisma.city.findUnique({ where: { id: ref }, select: { id: true } })
      ?? await this.prisma.region.findUnique({ where: { id: ref }, select: { id: true } });
    if (!exists) {
      throw new Error(`Unknown ${field}`);
    }
    return exists as City | Region;
  }

  private async uniqueListingSlug(
    title: string,
    taken: (slug: string) => Promise<{ id: string } | null>,
  ): Promise<string> {
    const base = title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100);
    let candidate = base || "listing";
    for (let n = 2; ; n++) {
      if (!(await taken(candidate))) return candidate;
      candidate = `${base}-${n}`;
    }
  }
}
