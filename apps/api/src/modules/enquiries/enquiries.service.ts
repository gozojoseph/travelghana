import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@travelghana/database";
import type { Enquiry, EnquiryStatus } from "@travelghana/types";
import {
  ENQUIRY_STATUS_TRANSITIONS,
  type EnquiryCreateInput,
  type EnquiryListQuery,
  type EnquiryUpdateInput,
} from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";
import { MAILER, Mailer } from "../mail/mailer";

type EnquiryRow = Prisma.EnquiryGetPayload<Record<string, never>>;

/** Enquiry requester identity when the capture happened with a session. */
export interface EnquiryRequester {
  id: string;
  email: string;
  name: string | null;
}

/** Derives the coarse budget string from a linked trip (never a price quote). */
function deriveBudgetRange(
  budgetMinor: number | null,
  budgetType: string | null | undefined,
  currencyCode: string,
  includesFlights: boolean,
): string | null {
  if (budgetMinor === null) return null;
  const major = budgetMinor / 100;
  const formatted = `${currencyCode} ${major.toLocaleString("en-US")}`;
  const base =
    budgetType === "PER_PERSON"
      ? `${formatted} per person`
      : `${formatted} per group`;
  return includesFlights ? `${base} (incl. flights)` : base;
}

/**
 * D6 concierge workflow — enquiries are the honest handoff between the
 * planner and the concierge team: the traveler asks, a human replies and
 * quotes by email. Nothing here creates or promises a booking (Phase 4).
 */
@Injectable()
export class EnquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  /** Public + workspace capture. Session identity enriches, never overrides. */
  async create(input: EnquiryCreateInput, requester?: EnquiryRequester | null): Promise<Enquiry> {
    let trip: {
      id: string;
      startDate: Date | null;
      endDate: Date | null;
      adults: number;
      children: number;
      interests: string[];
      destinationPreferences: string[];
      budgetMinor: number | null;
      budgetType: string;
      budgetIncludesFlights: boolean;
      currencyCode: string;
    } | null = null;

    if (input.tripId) {
      if (!requester) {
        throw ApiError.unauthorized("Sign in to send an enquiry together with your trip");
      }
      const row = await this.prisma.trip.findFirst({
        where: { id: input.tripId, ownerUserId: requester.id },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          adults: true,
          children: true,
          interests: true,
          destinationPreferences: true,
          budgetMinor: true,
          budgetType: true,
          budgetIncludesFlights: true,
          currencyCode: true,
        },
      });
      if (!row) throw ApiError.notFound("Trip not found", "TRIP_NOT_FOUND");
      trip = row;
    }

    const name = input.name?.trim() || requester?.name || null;
    const email = input.email ?? requester?.email ?? null;
    if (!name || !email) {
      throw ApiError.badRequest(
        "The concierge team needs a name and an email to reply",
        "MISSING_CONTACT",
      );
    }

    // Snapshots come from the trip unless the traveler typed their own.
    const destinationSnapshot =
      input.destinations && input.destinations.length > 0
        ? input.destinations
        : trip
          ? (
              await this.prisma.destination.findMany({
                where: { id: { in: trip.destinationPreferences } },
                select: { name: true },
                orderBy: { name: "asc" },
              })
            ).map((d) => d.name)
          : [];
    const interestSnapshot =
      input.interests && input.interests.length > 0
        ? input.interests
        : (trip?.interests ?? []);
    const budgetRange =
      input.budgetRange == null || input.budgetRange.trim() === ""
        ? trip
          ? deriveBudgetRange(
              trip.budgetMinor,
              trip.budgetType,
              trip.currencyCode,
              trip.budgetIncludesFlights,
            )
          : null
        : input.budgetRange;

    const row = await this.createWithRetry(() => {
      const code = this.generateCode();
      return this.prisma.enquiry.create({
        data: {
          code,
          name,
          email,
          userId: requester?.id ?? null,
          tripId: trip?.id ?? null,
          startDate: trip?.startDate ?? null,
          endDate: trip?.endDate ?? null,
          adults: input.adults ?? trip?.adults ?? 1,
          children: input.children ?? trip?.children ?? 0,
          destinations: destinationSnapshot,
          interests: interestSnapshot,
          budgetRange: budgetRange || null,
          accommodationPref: input.accommodationPref || null,
          transportPref: input.transportPref || null,
          specialRequests: input.specialRequests || null,
        },
        select: { code: true, id: true },
      });
    });

    // Ops records land in the platform's own tables: the audit trail + a
    // queued notification for the signed-in requester. Guests are recorded
    // in the audit trail only — Notification requires an account.
    await this.audit(
      requester?.id ?? null,
      "ENQUIRY_CREATED",
      { enquiryId: row.id, code: row.code, email, hasTrip: Boolean(trip) },
    );
    if (requester) {
      await this.prisma.notification.create({
        data: {
          userId: requester.id,
          channel: "EMAIL",
          type: "ENQUIRY_RECEIVED",
          payload: { enquiryId: row.id, code: row.code, email },
          status: "QUEUED",
        },
      });
    }

    // Confirmation to the requester — the concierge conversation itself
    // happens on their own mailbox (OPEN_QUESTIONS #9: no provider yet).
    await this.mailer.send({
      to: email,
      subject: `We received your TravelGhana enquiry (${row.code})`,
      text: `Hi${name !== null ? ` ${name}` : ""},\n\nThanks for reaching out! Your enquiry reference is ${row.code}. A member of our concierge team will reply to this address within about two working days.\n\nThis is an enquiry — nothing is booked or charged yet.\n\n— The TravelGhana concierge team`,
    });

    const full = await this.get(row.id);
    return full;
  }

  /** Admin queue list — filtered by pipeline stage and searched by text. */
  async list(query: EnquiryListQuery): Promise<Enquiry[]> {
    const where: Prisma.EnquiryWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
        { code: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const rows = await this.prisma.enquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((row) => this.toDto(row));
  }

  async get(id: string): Promise<Enquiry> {
    const row = await this.prisma.enquiry.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound("Enquiry not found", "ENQUIRY_NOT_FOUND");
    return this.toDto(row);
  }

  async update(id: string, input: EnquiryUpdateInput): Promise<Enquiry> {
    const row = await this.prisma.enquiry.findUnique({
      where: { id },
      select: { id: true, status: true, code: true },
    });
    if (!row) throw ApiError.notFound("Enquiry not found", "ENQUIRY_NOT_FOUND");

    const data: Prisma.EnquiryUpdateInput = {};
    if (input.status !== undefined) {
      const allowed = ENQUIRY_STATUS_TRANSITIONS[row.status] ?? [];
      if (!allowed.includes(input.status)) {
        throw ApiError.badRequest(
          `An enquiry in ${row.status} can move to ${allowed.length > 0 ? allowed.join(" or ") : "no further stage"}`,
          "INVALID_STATUS_TRANSITION",
        );
      }
      data.status = input.status;
    }
    if (input.assignedAdminId !== undefined) {
      data.assignedAdminId = input.assignedAdminId;
    }

    const updated = await this.prisma.enquiry.update({ where: { id }, data });
    await this.audit(null, "ENQUIRY_UPDATED", {
      enquiryId: id,
      code: row.code,
      status: updated.status,
    });
    return this.toDto(updated);
  }

  /** Spam / personal-data cleanup (D28). The audit row keeps the reference. */
  async remove(adminId: string, id: string): Promise<{ message: string }> {
    const row = await this.prisma.enquiry.findUnique({
      where: { id },
      select: { id: true, code: true, status: true, email: true },
    });
    if (!row) throw ApiError.notFound("Enquiry not found", "ENQUIRY_NOT_FOUND");

    await this.prisma.enquiry.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "ENQUIRY_DELETED",
        entityType: "Enquiry",
        entityId: row.id,
        meta: { code: row.code, status: row.status, email: row.email },
      },
    });
    return { message: `Enquiry ${row.code} deleted` };
  }

  /** Human reference minted outside the DB so support can read it aloud. */
  private generateCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I/L lookalikes
    const bytes = randomBytes(6);
    let code = "";
    for (const byte of bytes) code += alphabet[byte % alphabet.length];
    return `ENQ-${code}`;
  }

  /** Unique `code` collisions are expected to be rare; bounded retries. */
  private async createWithRetry<T>(run: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await run();
      } catch (error) {
        lastError = error;
        const code = (error as { code?: string })?.code;
        if (code !== "P2002") throw error;
      }
    }
    throw lastError;
  }

  private async audit(
    actorUserId: string | null,
    action: string,
    meta: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { actorUserId, action, entityType: "Enquiry", entityId: null, meta },
    });
  }

  private toDto(row: EnquiryRow): Enquiry {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      email: row.email,
      phone: row.phone,
      tripId: row.tripId,
      startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : null,
      endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
      adults: row.adults,
      children: row.children,
      destinations: row.destinations,
      interests: row.interests,
      budgetRange: row.budgetRange,
      accommodationPref: row.accommodationPref,
      transportPref: row.transportPref,
      specialRequests: row.specialRequests,
      status: row.status as EnquiryStatus,
      assignedAdminId: row.assignedAdminId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
