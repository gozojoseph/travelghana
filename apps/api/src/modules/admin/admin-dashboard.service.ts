import { Injectable } from "@nestjs/common";
import type { AdminStats } from "@travelghana/types";

import { PrismaService } from "../../common/prisma.service";

/**
 * Dashboard home counts. Every counter maps to a shipped admin section
 * (no fake zeros for unbuilt surfaces), and `recent` gives each section a
 * live snapshot of what is waiting on the admin right now.
 */
@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(): Promise<AdminStats> {
    const [
      listingsPendingReview,
      enquiriesNew,
      enquiriesUnassignedActive,
      packagesDraft,
      destinationsUnpublished,
      attractionsUnpublished,
      providersUnverified,
      notificationsQueued,
      usersActive,
      packageBookingsPending,
      reviewsPending,
      listingRequestsPending,
    ] = await Promise.all([
      this.prisma.listing.count({ where: { status: "PENDING_REVIEW" } }),
      this.prisma.enquiry.count({ where: { status: "NEW" } }),
      this.prisma.enquiry.count({
        where: { status: { in: ["NEW", "IN_REVIEW"] }, assignedAdminId: null },
      }),
      this.prisma.package.count({ where: { status: "DRAFT" } }),
      this.prisma.destination.count({ where: { published: false } }),
      this.prisma.attraction.count({ where: { published: false } }),
      this.prisma.provider.count({
        where: { verificationStatus: { in: ["UNVERIFIED", "PENDING"] } },
      }),
      // The outbox is honest about being queued-only (D20): counters reflect
      // what exists, the UI explains that no provider is wired yet.
      this.prisma.notification.count({ where: { status: "QUEUED" } }),
      this.prisma.user.count({ where: { status: "ACTIVE" } }),
      // Booking requests waiting for availability confirmation (D25/D27).
      this.prisma.packageBooking.count({ where: { status: "PENDING_PAYMENT" } }),
      // Package reviews waiting for a moderation decision (D42).
      this.prisma.packageReview.count({ where: { status: "PENDING" } }),
      // Transport listing requests with no team quote/decision yet (D43).
      this.prisma.listingBooking.count({ where: { status: "PENDING" } }),
    ]);

    const [recentEnquiries, recentListings, recentAudit] = await Promise.all([
      this.prisma.enquiry.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, code: true, name: true, email: true, status: true, createdAt: true },
      }),
      this.prisma.listing.findMany({
        where: { status: "PENDING_REVIEW" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          provider: { select: { name: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { actor: { select: { email: true } } },
      }),
    ]);

    return {
      counts: {
        listingsPendingReview,
        enquiriesNew,
        enquiriesUnassignedActive,
        packagesDraft,
        destinationsUnpublished,
        attractionsUnpublished,
        providersUnverified,
        notificationsQueued,
        usersActive,
        packageBookingsPending,
        reviewsPending,
        listingRequestsPending,
      },
      recent: {
        enquiries: recentEnquiries.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          email: row.email,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        })),
        listings: recentListings.map((row) => ({
          id: row.id,
          title: row.title,
          providerName: row.provider.name,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        })),
        audit: recentAudit.map((row) => ({
          id: row.id,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          actorEmail: row.actor?.email ?? null,
          createdAt: row.createdAt.toISOString(),
        })),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
