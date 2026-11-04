import { randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@travelghana/database";
import type {
  BookingStatus,
  PackageBooking as DbPackageBooking,
} from "@travelghana/database";
import type {
  AdminPackageBookingDto,
  AdminPackageBookingsResult,
  PackageBooking,
} from "@travelghana/types";
import type { PackageBookingCreateInput, PackageBookingListQuery } from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";
import { adminAppUrls, primaryWebAppUrl } from "../../common/config/app-urls";
import { MAILER, Mailer } from "../mail/mailer";
import { bookingAdminNoticeEmail, bookingEventEmail } from "../mail/email-templates";
import type { PackageBookingWithPackage, MyPackageBookingsResult } from "@travelghana/types";

type AdminBookingRow = Prisma.PackageBookingGetPayload<{
  include: {
    user: { select: { id: true; email: true; name: true } };
    package: { select: { id: true; slug: true; title: true; priceMinor: true } };
  };
}>;

type MineBookingRow = Prisma.PackageBookingGetPayload<{
  include: {
    package: {
      select: { id: true; slug: true; title: true; priceMinor: true; currencyCode: true };
    };
  };
}>;

/** Unambiguous mint alphabet (no O/0/1/I/L lookalikes), same as enquiry codes. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function mintCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `PB-${code}`;
}

/** Mail-ready presentation strings shared by every booking-related email. */
function describeBooking(row: {
  startDate: Date;
  adults: number;
  children: number;
}): { startLabel: string; party: string } {
  const startLabel = row.startDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const party = `${row.adults} ${row.adults === 1 ? "adult" : "adults"}${
    row.children > 0 ? `, ${row.children} ${row.children === 1 ? "child" : "children"}` : ""
  }`;
  return { startLabel, party };
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  /** A signed-in traveler books one published curated package (D25/D26). */
  async create(actorUserId: string, input: PackageBookingCreateInput): Promise<PackageBooking> {
    const [pkg, user] = await Promise.all([
      this.prisma.package.findUnique({
        where: { id: input.packageId },
        select: { id: true, title: true, status: true },
      }),
      this.prisma.user.findUnique({
        where: { id: actorUserId },
        select: { email: true, name: true },
      }),
    ]);
    if (!pkg || pkg.status !== "PUBLISHED") {
      throw ApiError.notFound("Package not found");
    }

    // D41: set-date journeys. Once an admin publishes departure dates for a
    // package the traveler must pick one - a chosen departure fixes the start
    // date and holds the party's seats until the booking is cancelled,
    // refunded or expired. Packages without departures stay open-dated.
    let startDate = input.startDate;
    let departureId: string | undefined;
    if (input.departureId) {
      const departure = await this.prisma.packageDeparture.findUnique({
        where: { id: input.departureId },
      });
      if (!departure || departure.packageId !== pkg.id) {
        throw ApiError.notFound(
          "That departure date was not found - please pick from the available dates",
        );
      }
      // Same 24h grace cut the booking schema uses for timezones.
      if (departure.date.getTime() <= Date.now() - 24 * 60 * 60 * 1000) {
        throw ApiError.conflict("That departure date has passed", "DEPARTURE_IN_PAST");
      }
      const occupied = await this.prisma.packageBooking.aggregate({
        where: {
          departureId: departure.id,
          status: { notIn: ["CANCELLED", "REFUNDED", "EXPIRED"] },
        },
        _sum: { adults: true, children: true },
      });
      const taken = (occupied._sum.adults ?? 0) + (occupied._sum.children ?? 0);
      if (departure.seats - taken < input.adults + input.children) {
        throw ApiError.conflict(
          "That departure does not have enough seats left for this party size - please choose another date",
          "DEPARTURE_FULL",
        );
      }
      startDate = departure.date;
      departureId = departure.id;
    } else {
      const departuresAhead = await this.prisma.packageDeparture.count({
        where: {
          packageId: pkg.id,
          date: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (departuresAhead > 0) {
        throw ApiError.conflict(
          "This journey runs on set departure dates - please pick one of the available dates",
          "DEPARTURE_REQUIRED",
        );
      }
    }

    const row = await this.prisma.packageBooking.create({
      data: {
        code: mintCode(),
        userId: actorUserId,
        packageId: input.packageId,
        startDate,
        ...(departureId ? { departureId } : {}),
        adults: input.adults,
        children: input.children,
        notes: input.notes ?? null,
      },
    });

    const meta: Prisma.InputJsonObject = {
      code: row.code,
      packageId: pkg.id,
      packageTitle: pkg.title,
      startDate: row.startDate.toISOString(),
      adults: row.adults,
      children: row.children,
      // Departure reference when the request was made against a set date.
      departureDate: departureId ? row.startDate.toISOString().slice(0, 10) : undefined,
    };
    await this.prisma.auditLog.create({
      data: { actorUserId, action: "PACKAGE_BOOKING_REQUESTED", entityType: "PackageBooking", entityId: row.id, meta },
    });

    // In-app outbox record - mirrors the D6 enquiry pattern. The email record
    // itself goes out underneath; failures never fail the booking (D34/D36).
    await this.prisma.notification.create({
      data: {
        userId: actorUserId,
        channel: "EMAIL",
        type: "PACKAGE_BOOKING_REQUESTED",
        payload: { bookingId: row.id, code: row.code, packageId: pkg.id },
        status: "QUEUED",
      },
    });

    if (user) {
      const { startLabel, party } = describeBooking(row);
      await this.mailer.send({
        to: user.email,
        ...bookingEventEmail({
          kind: "received",
          name: user.name,
          code: row.code,
          packageTitle: pkg.title,
          startLabel,
          party,
          adminMessage: row.notes,
          url: `${primaryWebAppUrl()}/account`,
        }),
      });
      // A copy to the owner inbox when ADMIN_EMAIL is configured (best
      // effort - the bookings queue in the console is the source of truth).
      const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim();
      if (adminEmail) {
        await this.mailer.send({
          to: adminEmail,
          ...bookingAdminNoticeEmail({
            code: row.code,
            packageTitle: pkg.title,
            startLabel,
            party,
            traveler: `${user.name ?? "Member"} (${user.email})`,
            notes: row.notes,
            url: `${adminAppUrls()[0]}/admin/bookings`,
          }),
        });
      }
    }

    return this.toDto(row);
  }

  /** The traveler's own booking requests - newest first (D26). */
  async listMine(userId: string): Promise<MyPackageBookingsResult> {
    const where = { userId };
    const pageSize = 50;
    const [total, rows] = await Promise.all([
      this.prisma.packageBooking.count({ where }),
      this.prisma.packageBooking.findMany({
        where,
        include: {
          package: {
            select: { id: true, slug: true, title: true, priceMinor: true, currencyCode: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => this.toMineDto(row)),
      total,
    };
  }

  /** Admin console queue - newest first, optional status filter. */
  async listAdmin(query: PackageBookingListQuery): Promise<AdminPackageBookingsResult> {
    const where = query.status ? { status: query.status } : {};
    const pageSize = 50;
    const [total, rows] = await Promise.all([
      this.prisma.packageBooking.count({ where }),
      this.prisma.packageBooking.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
          package: { select: { id: true, slug: true, title: true, priceMinor: true } },
        },
        orderBy: { createdAt: "desc" },
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => this.toAdminDto(row)),
      total,
      page: 1,
      pageSize,
      pages: rows.length < pageSize ? 1 : Math.ceil(total / pageSize),
    };
  }

  /**
   * Ops cleanup for junk requests (D28): a hard delete here is data removal,
   * not a booking decision - status transitions still belong to payment rails.
   * CONFIRMED, COMPLETED and REFUNDED rows are financial records and can never
   * be deleted; PENDING_PAYMENT, CANCELLED and EXPIRED can.
   */
  async remove(adminId: string, id: string): Promise<{ message: string }> {
    const row = await this.prisma.packageBooking.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        status: true,
        userId: true,
        package: { select: { title: true } },
      },
    });
    if (!row) throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");

    const deletable: BookingStatus[] = ["PENDING_PAYMENT", "CANCELLED", "EXPIRED"];
    if (!deletable.includes(row.status)) {
      throw ApiError.conflict(
        "Confirmed, completed or refunded bookings are financial records and cannot be deleted",
        "FINANCIAL_RECORD_IMMUTABLE",
      );
    }

    await this.prisma.packageBooking.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "PACKAGE_BOOKING_DELETED",
        entityType: "PackageBooking",
        entityId: row.id,
        meta: {
          code: row.code,
          packageTitle: row.package.title,
          status: row.status,
          userId: row.userId,
        },
      },
    });
    return { message: `Booking ${row.code} deleted` };
  }

  /**
   * Admin actions (D36): three outreach moves that keep the traveler's own
   * mailbox in the loop, mirroring the booking queue in the console. Each one
   * is audited, creates a queued in-app notification, and sends an email -
   * never the other way around, and failures cannot undo the admin action.
   */

  /** "We're looking after it" - no status change, just contact. */
  async acknowledge(adminId: string, id: string, message?: string): Promise<{ message: string }> {
    const view = await this.loadAdminView(id);
    await this.prisma.notification.create({
      data: {
        userId: view.userId,
        channel: "EMAIL",
        type: "PACKAGE_BOOKING_ACKNOWLEDGED",
        payload: { bookingId: view.id, code: view.code, by: adminId },
        status: "QUEUED",
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "PACKAGE_BOOKING_ACKNOWLEDGED",
        entityType: "PackageBooking",
        entityId: view.id,
        meta: { code: view.code, status: view.status, hasMessage: Boolean(message) },
      },
    });
    await this.mailer.send({
      to: view.user.email,
      ...bookingEventEmail({
        kind: "acknowledged",
        name: view.user.name,
        code: view.code,
        packageTitle: view.package.title,
        startLabel: view.startLabel,
        party: view.party,
        adminMessage: message ?? null,
        url: `${primaryWebAppUrl()}/account`,
      }),
    });
    return { message: `Acknowledged booking ${view.code} - email sent to the traveler` };
  }

  /** A question or concern the team wants on the record for the traveler. */
  async concern(adminId: string, id: string, message: string): Promise<{ message: string }> {
    const view = await this.loadAdminView(id);
    await this.prisma.notification.create({
      data: {
        userId: view.userId,
        channel: "EMAIL",
        type: "PACKAGE_BOOKING_CONCERN",
        payload: { bookingId: view.id, code: view.code, by: adminId },
        status: "QUEUED",
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "PACKAGE_BOOKING_CONCERN",
        entityType: "PackageBooking",
        entityId: view.id,
        meta: { code: view.code, status: view.status },
      },
    });
    await this.mailer.send({
      to: view.user.email,
      ...bookingEventEmail({
        kind: "concern",
        name: view.user.name,
        code: view.code,
        packageTitle: view.package.title,
        startLabel: view.startLabel,
        party: view.party,
        adminMessage: message,
        url: `${primaryWebAppUrl()}/account`,
      }),
    });
    return { message: `Concern sent for booking ${view.code}` };
  }

  /**
   * The availability decision for a PAYMENT-PENDING request only (D36): the
   * payment rails own every later transition, so CONFIRMED/COMPLETED/REFUNDED
   * rows stay immutable here, exactly like the D28 delete guard.
   */
  async decide(
    adminId: string,
    id: string,
    input: { decision: "CONFIRMED" | "CANCELLED"; reason?: string },
  ): Promise<AdminPackageBookingDto> {
    const view = await this.loadAdminView(id);
    if (view.status !== "PENDING_PAYMENT") {
      throw ApiError.conflict(
        "Only payment-pending requests can be confirmed or cancelled from the console - later transitions follow the payment rails",
        "BOOKING_STATUS_IMMUTABLE",
      );
    }
    const cancelling = input.decision === "CANCELLED";
    const updated = await this.prisma.packageBooking.update({
      where: { id: view.id },
      // The reason is kept in the audit trail + the email/notification copy:
      // PackageBooking carries no free-text cancellation record.
      data: cancelling ? { status: "CANCELLED" } : { status: "CONFIRMED" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        package: { select: { id: true, slug: true, title: true, priceMinor: true } },
      },
    });
    await this.prisma.notification.create({
      data: {
        userId: view.userId,
        channel: "EMAIL",
        type: cancelling ? "PACKAGE_BOOKING_CANCELLED" : "PACKAGE_BOOKING_CONFIRMED",
        payload: {
          bookingId: view.id,
          code: view.code,
          by: adminId,
          ...(input.reason ? { reason: input.reason } : {}),
        },
        status: "QUEUED",
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: cancelling ? "PACKAGE_BOOKING_CANCELLED" : "PACKAGE_BOOKING_CONFIRMED",
        entityType: "PackageBooking",
        entityId: view.id,
        meta: { code: view.code, previousStatus: view.status, reason: input.reason ?? null },
      },
    });
    // Manual payment rails (D44): attach the team's payment instructions
    // verbatim when the settings payment section is filled in. The email copy
    // never adds amounts; the booking code is the payment reference.
    const settings = await this.prisma.siteSettings.findUnique({
      where: { id: "site" },
      select: { momoInstructions: true, bankInstructions: true },
    });
    await this.mailer.send({
      to: view.user.email,
      ...bookingEventEmail({
        kind: cancelling ? "cancelled" : "confirmed",
        name: view.user.name,
        code: view.code,
        packageTitle: view.package.title,
        startLabel: view.startLabel,
        party: view.party,
        adminMessage: input.reason ?? null,
        payment: cancelling
          ? null
          : {
              momo: settings?.momoInstructions ?? null,
              bank: settings?.bankInstructions ?? null,
            },
        url: `${primaryWebAppUrl()}/account`,
      }),
    });
    return this.toAdminDto(updated);
  }

  /**
   * Manual payments (D44): record that a CONFIRMED booking was paid (Mobile
   * Money or bank transfer, with the booking code as the reference). This
   * writes paidAt, notifies + emails the traveler and is audited - the status
   * itself is untouched because later transitions stay with the payment
   * rails. A paid date can be set once; corrections go through support.
   */
  async markPaid(adminId: string, id: string): Promise<AdminPackageBookingDto> {
    const view = await this.loadAdminView(id);
    if (view.status !== "CONFIRMED") {
      throw ApiError.conflict(
        "Only confirmed bookings can be marked as paid",
        "BOOKING_NOT_CONFIRMED",
      );
    }
    if (view.paidAt) {
      throw ApiError.conflict(
        "This booking is already marked as paid and the record cannot be changed from the console",
        "BOOKING_ALREADY_PAID",
      );
    }
    const updated = await this.prisma.packageBooking.update({
      where: { id: view.id },
      data: { paidAt: new Date() },
      include: {
        user: { select: { id: true, email: true, name: true } },
        package: { select: { id: true, slug: true, title: true, priceMinor: true } },
      },
    });
    await this.prisma.notification.create({
      data: {
        userId: updated.userId,
        channel: "EMAIL",
        type: "PACKAGE_BOOKING_PAID",
        payload: { bookingId: view.id, code: view.code, by: adminId },
        status: "QUEUED",
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "PACKAGE_BOOKING_PAID",
        entityType: "PackageBooking",
        entityId: view.id,
        meta: { code: view.code, status: view.status },
      },
    });
    await this.mailer.send({
      to: updated.user.email,
      ...bookingEventEmail({
        kind: "paid",
        name: updated.user.name,
        code: updated.code,
        packageTitle: updated.package.title,
        startLabel: view.startLabel,
        party: view.party,
        url: `${primaryWebAppUrl()}/account`,
      }),
    });
    return this.toAdminDto(updated);
  }

  /** ─── internals ─────────────────────────────────────────────────────── */

  /** Admin-viewable booking plus the mail-ready presentation strings. */
  private async loadAdminView(id: string) {
    const row = await this.prisma.packageBooking.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        status: true,
        paidAt: true,
        startDate: true,
        adults: true,
        children: true,
        userId: true,
        package: { select: { title: true } },
        user: { select: { email: true, name: true } },
      },
    });
    if (!row) throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");
    const { startLabel, party } = describeBooking(row);
    return { ...row, startLabel, party };
  }

  private toDto(row: DbPackageBooking): PackageBooking {
    return {
      id: row.id,
      code: row.code,
      packageId: row.packageId,
      startDate: row.startDate.toISOString(),
      adults: row.adults,
      children: row.children,
      notes: row.notes,
      status: row.status,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toMineDto(row: MineBookingRow): PackageBookingWithPackage {
    return {
      id: row.id,
      code: row.code,
      packageId: row.packageId,
      startDate: row.startDate.toISOString(),
      adults: row.adults,
      children: row.children,
      notes: row.notes,
      status: row.status,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      package: {
        id: row.package.id,
        slug: row.package.slug,
        title: row.package.title,
        priceMinor: row.package.priceMinor,
        currencyCode: row.package.currencyCode,
      },
    };
  }

  private toAdminDto(row: AdminBookingRow): AdminPackageBookingDto {
    return {
      id: row.id,
      code: row.code,
      packageId: row.packageId,
      startDate: row.startDate.toISOString(),
      adults: row.adults,
      children: row.children,
      notes: row.notes,
      status: row.status,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      package: {
        id: row.package.id,
        slug: row.package.slug,
        title: row.package.title,
        priceMinor: row.package.priceMinor,
      },
      user: {
        id: row.user.id,
        email: row.user.email,
        name: row.user.name,
      },
    };
  }
}
