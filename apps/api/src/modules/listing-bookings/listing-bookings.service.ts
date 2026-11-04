import { randomBytes } from "node:crypto";

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@travelghana/database";
import type {
  AdminListingRequest,
  AdminListingRequestsResult,
  ListingRequest,
  MyListingRequestsResult,
} from "@travelghana/types";
import type {
  ListingRequestCreateInput,
  ListingRequestDecisionInput,
  ListingRequestListQuery,
  ListingRequestQuoteInput,
} from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";
import { adminAppUrls, primaryWebAppUrl } from "../../common/config/app-urls";
import { MAILER, Mailer } from "../mail/mailer";
import {
  listingRequestAdminNoticeEmail,
  listingRequestEmail,
} from "../mail/email-templates";

type RequestRow = Prisma.ListingBookingGetPayload<{
  include: {
    user: { select: { id: true; email: true; name: true } };
    listing: {
      select: {
        id: true;
        slug: true;
        title: true;
        serviceArea: true;
        capacity: true;
        durationMinutes: true;
        provider: { select: { id: true; slug: true; name: true; type: true } };
      };
    };
  };
}>;

/**
 * Unambiguous mint alphabet (no O/0/1/I/L lookalikes), same as the PB- codes.
 * TB- marks a transport (listing) booking request.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function mintCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `TB-${code}`;
}

/** Mail-ready presentation strings for a transport request. */
function describeRequest(row: { startDate: Date; partySize: number }): {
  dateLabel: string;
  party: string;
} {
  const dateLabel = row.startDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const party = `${row.partySize} ${row.partySize === 1 ? "traveler" : "travelers"}`;
  return { dateLabel, party };
}

/**
 * Quote-only transport requests (D43). A signed-in traveler asks about one
 * published listing owned by a transport provider (transport company or
 * driver partner). There are no prices, seats or payments in this flow: the
 * team replies with a written quote (E43), then confirms or cancels - any
 * payment stays an off-platform conversation recorded nowhere.
 */
@Injectable()
export class ListingBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  /** A signed-in traveler requests a quote for one published transport listing. */
  async create(actorUserId: string, input: ListingRequestCreateInput): Promise<ListingRequest> {
    const [listing, user] = await Promise.all([
      this.prisma.listing.findUnique({
        where: { id: input.listingId },
        select: {
          id: true,
          status: true,
          capacity: true,
          provider: { select: { type: true } },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: actorUserId },
        select: { email: true, name: true },
      }),
    ]);
    if (
      !listing ||
      listing.status !== "PUBLISHED" ||
      (listing.provider.type !== "TRANSPORT_COMPANY" && listing.provider.type !== "DRIVER_PARTNER")
    ) {
      throw ApiError.notFound("Transport service not found");
    }
    if (input.partySize > listing.capacity) {
      throw ApiError.conflict(
        "This service seats fewer travelers than your party - send the request and the team will arrange it with you",
        "REQUEST_ABOVE_CAPACITY",
      );
    }

    const row = await this.prisma.listingBooking.create({
      data: {
        code: mintCode(),
        userId: actorUserId,
        listingId: input.listingId,
        startDate: input.startDate,
        partySize: input.partySize,
        notes: input.notes ?? null,
      },
      include: { listing: REQUEST_INCLUDE.listing, user: REQUEST_INCLUDE.user },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: "LISTING_REQUEST_SENT",
        entityType: "ListingBooking",
        entityId: row.id,
        meta: {
          code: row.code,
          listingId: row.listingId,
          listingTitle: row.listing.title,
          providerId: row.listing.provider.id,
        },
      },
    });
    await this.prisma.notification.create({
      data: {
        userId: actorUserId,
        channel: "EMAIL",
        type: "LISTING_REQUEST_SENT",
        payload: { requestId: row.id, code: row.code, listingId: row.listingId },
        status: "QUEUED",
      },
    });

    const { dateLabel, party } = describeRequest(row);
    if (user) {
      await this.mailer.send({
        to: user.email,
        ...listingRequestEmail({
          kind: "received",
          name: user.name,
          code: row.code,
          listingTitle: row.listing.title,
          providerName: row.listing.provider.name,
          serviceArea: row.listing.serviceArea,
          dateLabel,
          party,
          teamMessage: row.notes,
          url: `${primaryWebAppUrl()}/account`,
        }),
      });
      // Best-effort copy to the owner inbox when ADMIN_EMAIL is configured -
      // the queue in the console stays the source of truth.
      const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim();
      if (adminEmail) {
        await this.mailer.send({
          to: adminEmail,
          ...listingRequestAdminNoticeEmail({
            code: row.code,
            listingTitle: row.listing.title,
            providerName: row.listing.provider.name,
            dateLabel,
            party,
            traveler: `${user.name ?? "Member"} (${user.email})`,
            notes: row.notes,
            url: `${adminAppUrls()[0]}/admin/transport`,
          }),
        });
      }
    }

    return this.listingContext(row);
  }

  /** The traveler's own transport requests - newest first (D43). */
  async listMine(userId: string): Promise<MyListingRequestsResult> {
    const where = { userId };
    const pageSize = 50;
    const [total, rows] = await Promise.all([
      this.prisma.listingBooking.count({ where }),
      this.prisma.listingBooking.findMany({
        where,
        include: { listing: REQUEST_INCLUDE.listing, user: REQUEST_INCLUDE.user },
        orderBy: { createdAt: "desc" },
        take: pageSize,
      }),
    ]);
    return { items: rows.map((row) => this.listingContext(row)), total };
  }

  /** Admin console queue - newest first, optional status filter. */
  async listAdmin(query: ListingRequestListQuery): Promise<AdminListingRequestsResult> {
    const where = query.status ? { status: query.status } : {};
    const pageSize = 50;
    const [total, rows] = await Promise.all([
      this.prisma.listingBooking.count({ where }),
      this.prisma.listingBooking.findMany({
        where,
        include: { listing: REQUEST_INCLUDE.listing, user: REQUEST_INCLUDE.user },
        orderBy: { createdAt: "desc" },
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => this.adminContext(row)),
      total,
      page: 1,
      pageSize,
      pages: rows.length < pageSize ? 1 : Math.ceil(total / pageSize),
    };
  }

  /** The team's written quote: emailed and kept so the traveler can re-read it. */
  async quote(
    adminId: string,
    id: string,
    input: ListingRequestQuoteInput,
  ): Promise<{ message: string }> {
    const view = await this.loadAdminView(id);
    if (view.status !== "PENDING") {
      throw ApiError.conflict(
        "Quotes are only sent while a request is pending - later transitions belong to the decision",
        "REQUEST_STATUS_IMMUTABLE",
      );
    }
    await this.prisma.listingBooking.update({
      where: { id: view.id },
      data: { quoteNote: input.message, quoteAt: new Date() },
      include: { listing: REQUEST_INCLUDE.listing, user: REQUEST_INCLUDE.user },
    });
    await this.prisma.notification.create({
      data: {
        userId: view.userId,
        channel: "EMAIL",
        type: "LISTING_REQUEST_QUOTED",
        payload: { requestId: view.id, code: view.code, by: adminId, message: input.message },
        status: "QUEUED",
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "LISTING_REQUEST_QUOTED",
        entityType: "ListingBooking",
        entityId: view.id,
        meta: { code: view.code, listingTitle: view.listing.title, message: input.message },
      },
    });
    const { dateLabel, party } = describeRequest(view);
    await this.mailer.send({
      to: view.user.email,
      ...listingRequestEmail({
        kind: "quote",
        name: view.user.name,
        code: view.code,
        listingTitle: view.listing.title,
        providerName: view.listing.provider.name,
        serviceArea: view.listing.serviceArea,
        dateLabel,
        party,
        teamMessage: input.message,
        url: `${primaryWebAppUrl()}/account`,
      }),
    });
    return { message: `Quote sent for request ${view.code}` };
  }

  /** Confirm or cancel a pending request - audited, notified, emailed. */
  async decide(
    adminId: string,
    id: string,
    input: ListingRequestDecisionInput,
  ): Promise<AdminListingRequest> {
    const view = await this.loadAdminView(id);
    if (view.status !== "PENDING") {
      throw ApiError.conflict(
        "Only pending requests can be confirmed or cancelled - this one is already decided",
        "REQUEST_STATUS_IMMUTABLE",
      );
    }
    const cancelling = input.decision === "CANCELLED";
    const updated = await this.prisma.listingBooking.update({
      where: { id: view.id },
      data: { status: cancelling ? "CANCELLED" : "CONFIRMED", decidedAt: new Date() },
      include: { listing: REQUEST_INCLUDE.listing, user: REQUEST_INCLUDE.user },
    });
    await this.prisma.notification.create({
      data: {
        userId: view.userId,
        channel: "EMAIL",
        type: cancelling ? "LISTING_REQUEST_CANCELLED" : "LISTING_REQUEST_CONFIRMED",
        payload: {
          requestId: view.id,
          code: view.code,
          by: adminId,
          ...(input.message ? { message: input.message } : {}),
        },
        status: "QUEUED",
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: cancelling ? "LISTING_REQUEST_CANCELLED" : "LISTING_REQUEST_CONFIRMED",
        entityType: "ListingBooking",
        entityId: view.id,
        meta: { code: view.code, previousStatus: view.status, message: input.message ?? null },
      },
    });
    const { dateLabel, party } = describeRequest(view);
    await this.mailer.send({
      to: view.user.email,
      ...listingRequestEmail({
        kind: cancelling ? "cancelled" : "confirmed",
        name: view.user.name,
        code: view.code,
        listingTitle: view.listing.title,
        providerName: view.listing.provider.name,
        serviceArea: view.listing.serviceArea,
        dateLabel,
        party,
        teamMessage: input.message ?? null,
        url: `${primaryWebAppUrl()}/account`,
      }),
    });
    return this.adminContext(updated);
  }

  /**
   * Ops cleanup (D28 spirit): a quote conversation is not a financial record,
   * so any state can be removed; the audit trail keeps what happened.
   */
  async remove(adminId: string, id: string): Promise<{ message: string }> {
    const view = await this.loadAdminView(id);
    await this.prisma.listingBooking.delete({ where: { id: view.id } });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "LISTING_REQUEST_DELETED",
        entityType: "ListingBooking",
        entityId: view.id,
        meta: { code: view.code, status: view.status, listingTitle: view.listing.title, userId: view.userId },
      },
    });
    return { message: `Request ${view.code} deleted` };
  }

  /** ─── internals ─────────────────────────────────────────────────────── */

  private async loadAdminView(id: string) {
    const row = await this.prisma.listingBooking.findUnique({
      where: { id },
      include: { listing: REQUEST_INCLUDE.listing, user: REQUEST_INCLUDE.user },
    });
    if (!row) throw new NotFoundException("Transport request not found");
    // Mail-ready presentation strings ride along with the row.
    return { ...row, ...describeRequest(row) };
  }

  private listingContext(row: RequestRow): ListingRequest {
    return {
      id: row.id,
      code: row.code,
      listingId: row.listingId,
      startDate: row.startDate.toISOString(),
      partySize: row.partySize,
      notes: row.notes,
      status: row.status,
      quoteNote: row.quoteNote,
      quoteAt: row.quoteAt ? row.quoteAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      listing: {
        id: row.listing.id,
        slug: row.listing.slug,
        title: row.listing.title,
        serviceArea: row.listing.serviceArea,
        capacity: row.listing.capacity,
        durationMinutes: row.listing.durationMinutes,
        provider: {
          id: row.listing.provider.id,
          slug: row.listing.provider.slug,
          name: row.listing.provider.name,
          type: row.listing.provider.type,
        },
      },
    };
  }

  private adminContext(row: RequestRow): AdminListingRequest {
    return {
      ...this.listingContext(row),
      decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
      user: { id: row.user.id, email: row.user.email, name: row.user.name },
    };
  }
}

const REQUEST_INCLUDE = {
  listing: {
    select: {
      id: true,
      slug: true,
      title: true,
      serviceArea: true,
      capacity: true,
      durationMinutes: true,
      provider: { select: { id: true, slug: true, name: true, type: true } },
    },
  },
  user: { select: { id: true, email: true, name: true } },
} as const;
