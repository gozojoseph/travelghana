import { Injectable } from "@nestjs/common";
import type { Prisma } from "@travelghana/database";
import type { AdminProviderDto, AdminProvidersResult } from "@travelghana/types";
import type { AdminProviderPatchInput, AdminProvidersQuery } from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";

type ProviderWithRefs = Prisma.ProviderGetPayload<{
  include: {
    user: { select: { email: true } };
    city: { select: { name: true } };
  };
}>;

/**
 * Provider verification queue (D20 Phase 4). Admins flip verificationStatus;
 * the owning user (when the operator has an account) gets a queued EMAIL
 * notification — the outbox is the delivery mechanism of record until a real
 * provider is wired (OPEN_QUESTIONS #9).
 */
@Injectable()
export class AdminProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminProvidersQuery): Promise<AdminProvidersResult> {
    const where: Prisma.ProviderWhereInput = {
      ...(query.verificationStatus
        ? { verificationStatus: query.verificationStatus }
        : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { slug: { contains: query.q, mode: "insensitive" } },
              { user: { email: { contains: query.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.provider.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: { select: { email: true } },
          city: { select: { name: true } },
        },
      }),
      this.prisma.provider.count({ where }),
    ]);

    // Listing counts for exactly the providers on this page — one grouped
    // query each (not per-row lookups), since queues are read constantly.
    const providerIds = rows.map((row) => row.id);
    const [allListings, publishedListings] = await Promise.all([
      providerIds.length
        ? this.prisma.listing.groupBy({
            by: ["providerId"],
            where: { providerId: { in: providerIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      providerIds.length
        ? this.prisma.listing.groupBy({
            by: ["providerId"],
            where: { providerId: { in: providerIds }, status: "PUBLISHED" },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);
    const totalMap = new Map(allListings.map((g) => [g.providerId, g._count._all]));
    const publishedMap = new Map(
      publishedListings.map((g) => [g.providerId, g._count._all]),
    );

    return {
      items: rows.map((row) => this.toDto(row, totalMap, publishedMap)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async setVerificationStatus(
    actingAdminId: string,
    providerId: string,
    input: AdminProviderPatchInput,
  ): Promise<{ provider: AdminProviderDto }> {
    const provider = await this.findProvider(providerId);
    if (!provider) throw ApiError.notFound("Provider not found");

    if (provider.verificationStatus === input.verificationStatus) {
      return { provider: this.toDto(provider, new Map(), new Map()) };
    }

    const updated = await this.prisma.provider.update({
      where: { id: provider.id },
      data: { verificationStatus: input.verificationStatus },
      include: {
        user: { select: { email: true } },
        city: { select: { name: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actingAdminId,
        action: "PROVIDER_VERIFICATION_UPDATED",
        entityType: "Provider",
        entityId: provider.id,
        meta: {
          name: provider.name,
          from: provider.verificationStatus,
          to: input.verificationStatus,
        },
      },
    });

    if (provider.userId) {
      await this.prisma.notification.create({
        data: {
          userId: provider.userId,
          channel: "EMAIL",
          type: "PROVIDER_VERIFICATION",
          payload: {
            providerId: provider.id,
            name: provider.name,
            verificationStatus: input.verificationStatus,
          },
          status: "QUEUED",
        },
      });
    }

    return { provider: this.toDto(updated, new Map(), new Map()) };
  }

  private findProvider(providerId: string): Promise<ProviderWithRefs | null> {
    return this.prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        user: { select: { email: true } },
        city: { select: { name: true } },
      },
    });
  }

  private toDto(
    row: ProviderWithRefs,
    totalMap: Map<string, number>,
    publishedMap: Map<string, number>,
  ): AdminProviderDto {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      slug: row.slug,
      verificationStatus: row.verificationStatus,
      description: row.description,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      cityId: row.cityId,
      cityName: row.city?.name ?? null,
      userId: row.userId,
      userEmail: row.user?.email ?? null,
      listingsTotal: totalMap.get(row.id) ?? 0,
      listingsPublished: publishedMap.get(row.id) ?? 0,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
