import { Injectable } from "@nestjs/common";
import type { Prisma } from "@travelghana/database";
import type {
  AdminPackageReviewDto,
  AdminPackageReviewsResult,
  PackageReviewStatus,
  PackageReviewsResult,
  ReviewEligibilityDto,
} from "@travelghana/types";
import type {
  AdminReviewListQuery,
  ReviewCreateInput,
  ReviewEligibilityQuery,
  ReviewListQuery,
} from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";

/** One booking never yields two reviews: bookingId is unique, and a second
 * booking on the same package by the same user is blocked by the
 * userId+packageId lookups below. */

/**
 * Package reviews (D42). The gate that matters: the traveler writes only when
 * at least one of their bookings for the package is CONFIRMED by the team
 * (owner decision in the Phase 2 planning round). Approved views are the only
 * public surface; the queue is the only moderation surface.
 */
@Injectable()
export class PackageReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** What the traveler-side form asks first: can this member review, and
   * did they already (any status). Cheap two-query read. */
  async eligibility(
    userId: string,
    query: ReviewEligibilityQuery,
  ): Promise<ReviewEligibilityDto> {
    const [confirmed, existing] = await Promise.all([
      this.prisma.packageBooking.findFirst({
        where: { userId, packageId: query.packageId, status: "CONFIRMED" },
        select: { id: true },
      }),
      this.prisma.packageReview.findFirst({
        where: { userId, packageId: query.packageId },
        select: { id: true, status: true },
      }),
    ]);
    return {
      eligible: Boolean(confirmed),
      existing: existing ? { id: existing.id, status: existing.status as PackageReviewStatus } : null,
    };
  }

  /** Submit: requires a confirmed booking on the package AND no review on
   * that package from this user yet. Lands PENDING - moderation is an admin
   * decision, never an automatic publish. */
  async createForUser(
    userId: string,
    input: ReviewCreateInput,
  ): Promise<{ status: PackageReviewStatus }> {
    const pkg = await this.prisma.package.findUnique({
      where: { id: input.packageId },
      select: { id: true },
    });
    if (!pkg) throw ApiError.notFound("Package not found");

    const booking = await this.prisma.packageBooking.findFirst({
      where: { userId, packageId: pkg.id, status: "CONFIRMED" },
      select: { id: true },
    });
    if (!booking) {
      throw ApiError.forbidden(
        "You can write a review once your booking for this journey is confirmed",
        "REVIEW_NOT_UNLOCKED",
      );
    }

    const existing = await this.prisma.packageReview.findFirst({
      where: { userId, packageId: pkg.id },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.conflict(
        "You have already written a review for this journey",
        "REVIEW_ALREADY_SUBMITTED",
      );
    }

    const row = await this.prisma.packageReview.create({
      data: {
        bookingId: booking.id,
        packageId: pkg.id,
        userId,
        rating: input.rating,
        body: input.body ?? null,
        status: "PENDING",
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: "REVIEW_SUBMITTED",
        entityType: "PackageReview",
        entityId: row.id,
        meta: { packageId: pkg.id, bookingId: booking.id, rating: input.rating },
      },
    });
    return { status: "PENDING" };
  }

  /** Public list for a PACKAGE page: approved only, addressed by slug so the
   * web server-fetcher matches the detail page's URL semantics. */
  async listPublic(query: ReviewListQuery): Promise<PackageReviewsResult> {
    const pkg = await this.prisma.package.findUnique({
      where: { slug: query.packageSlug, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!pkg) throw ApiError.notFound("Package not found");

    const [rows, aggregate] = await Promise.all([
      this.prisma.packageReview.findMany({
        where: { packageId: pkg.id, status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { author: { select: { name: true } } },
      }),
      this.prisma.packageReview.aggregate({
        where: { packageId: pkg.id, status: "APPROVED" },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        body: row.body,
        authorName: row.author.name ?? "Traveler",
        createdAt: row.createdAt.toISOString(),
      })),
      summary: {
        average: aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
        count: aggregate._count.rating,
      },
    };
  }

  /** Console queue. Newest first, optionally bucketed by status, with the
   * author, booking and package context moderation needs. */
  async listAdmin(query: AdminReviewListQuery): Promise<AdminPackageReviewsResult> {
    const where: Prisma.PackageReviewWhereInput = {};
    if (query.status) where.status = query.status;
    const [rows, total] = await Promise.all([
      this.prisma.packageReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          author: { select: { id: true, name: true, email: true } },
          booking: { select: { id: true, code: true, status: true, startDate: true } },
          package: { select: { id: true, slug: true, title: true } },
        },
      }),
      this.prisma.packageReview.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.toAdminDto(row)),
      total,
    };
  }

  /** Decisions are only for PENDING rows - denied and approved reviews are
   * part of the record, same philosophy as booking decisions (D36). */
  async approve(adminId: string, id: string): Promise<{ review: AdminPackageReviewDto }> {
    await this.loadForDecision(id);
    const updated = await this.prisma.packageReview.update({
      where: { id },
      data: { status: "APPROVED", decisionNote: null },
      include: this.adminInclude(),
    });
    await this.audit(adminId, id, updated.bookingId, "REVIEW_APPROVED", updated.rating, null);
    return { review: this.toAdminDto(updated) };
  }

  async reject(
    adminId: string,
    id: string,
    reason: string,
  ): Promise<{ review: AdminPackageReviewDto }> {
    await this.loadForDecision(id);
    const updated = await this.prisma.packageReview.update({
      where: { id },
      data: { status: "REJECTED", decisionNote: reason },
      include: this.adminInclude(),
    });
    await this.audit(adminId, id, updated.bookingId, "REVIEW_REJECTED", updated.rating, reason);
    return { review: this.toAdminDto(updated) };
  }

  private adminInclude() {
    return {
      author: { select: { id: true, name: true, email: true } },
      booking: { select: { id: true, code: true, status: true, startDate: true } },
      package: { select: { id: true, slug: true, title: true } },
    } satisfies Prisma.PackageReviewInclude;
  }

  private toAdminDto(
    row: Prisma.PackageReviewGetPayload<{
      include: ReturnType<PackageReviewsService["adminInclude"]>;
    }>,
  ): AdminPackageReviewDto {
    return {
      id: row.id,
      rating: row.rating,
      body: row.body,
      status: row.status as PackageReviewStatus,
      decisionNote: row.decisionNote,
      createdAt: row.createdAt.toISOString(),
      author: row.author,
      booking: {
        id: row.booking.id,
        code: row.booking.code,
        status: row.booking.status,
        startDate: row.booking.startDate.toISOString(),
      },
      package: row.package,
    };
  }

  private async loadForDecision(id: string): Promise<void> {
    const row = await this.prisma.packageReview.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound("Review not found");
    if (row.status !== "PENDING") {
      throw ApiError.conflict(
        "Only pending reviews can be approved or rejected - decided reviews stay decided",
        "REVIEW_STATUS_IMMUTABLE",
      );
    }
  }

  private async audit(
    adminId: string,
    id: string,
    bookingId: string,
    action: string,
    rating: number,
    reason: string | null,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action,
        entityType: "PackageReview",
        entityId: id,
        meta: { bookingId, rating, ...(reason ? { reason } : {}) },
      },
    });
  }
}
