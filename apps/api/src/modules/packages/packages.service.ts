import { Injectable } from "@nestjs/common";
import type { Prisma } from "@travelghana/database";
import type {
  PackageDepartureDto,
  PackageDetail,
  PackageSummary,
} from "@travelghana/types";
import type {
  DepartureBulkCreateInput,
  DepartureCreateInput,
  DepartureUpdateInput,
  PackageCreateInput,
  PackageListQuery,
  PackageUpdateInput,
} from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";

const MAX_SLUG = 100;

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG);
  return base || "package";
}

/** Empty optional strings are stored as NULL; undefined means "leave alone". */
function nullableText(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value.trim() === "" ? null : value;
}

function dayCreateInput(day: {
  dayNumber: number;
  title: string;
  description?: string;
  meals?: string;
  accommodation?: string;
}): Prisma.PackageDayCreateWithoutPackageInput {
  return {
    dayNumber: day.dayNumber,
    title: day.title,
    description: nullableText(day.description) ?? null,
    meals: nullableText(day.meals) ?? null,
    accommodation: nullableText(day.accommodation) ?? null,
  };
}

const packageSummaryInclude = {
  destination: { include: { city: { include: { region: true } } } },
  _count: { select: { days: true } },
} satisfies Prisma.PackageInclude;

const packageDetailInclude = {
  ...packageSummaryInclude,
  days: { orderBy: { dayNumber: "asc" } },
} satisfies Prisma.PackageInclude;

type PackageSummaryRow = Prisma.PackageGetPayload<{ include: typeof packageSummaryInclude }>;
type PackageDetailRow = Prisma.PackageGetPayload<{ include: typeof packageDetailInclude }>;

/**
 * Admin-managed curated packages (platform-owned, not provider inventory).
 *
 * The day-by-day outline is replaced as a set on update, which keeps the API
 * (and the admin form) simple: one package payload, one transaction, no
 * separate day endpoints to reconcile.
 */
@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PackageListQuery): Promise<PackageSummary[]> {
    const where: Prisma.PackageWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { summary: { contains: query.q, mode: "insensitive" } },
        { destination: { is: { name: { contains: query.q, mode: "insensitive" } } } },
      ];
    }

    const rows = await this.prisma.package.findMany({
      where,
      include: packageSummaryInclude,
      orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
      take: 200,
    });

    return rows.map((row) => this.toSummary(row));
  }

  async get(id: string): Promise<PackageDetail> {
    const row = await this.prisma.package.findUnique({
      where: { id },
      include: packageDetailInclude,
    });
    if (!row) throw ApiError.notFound("Package not found");
    return this.toDetail(row);
  }

  /** Public catalog: published packages only, featured first. */
  async listPublished(): Promise<PackageSummary[]> {
    const rows = await this.prisma.package.findMany({
      where: { status: "PUBLISHED" },
      include: packageSummaryInclude,
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { updatedAt: "desc" }],
      take: 100,
    });
    return rows.map((row) => this.toSummary(row));
  }

  /** Public detail: a draft or archived package is indistinguishable from a 404. */
  async getPublishedBySlug(slug: string): Promise<PackageDetail> {
    const row = await this.prisma.package.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: packageDetailInclude,
    });
    if (!row) throw ApiError.notFound("Package not found");
    return this.toDetail(row);
  }

  async create(input: PackageCreateInput): Promise<PackageDetail> {
    if (input.destinationId) await this.assertDestination(input.destinationId);
    this.assertUniqueDayNumbers(input.days);
    this.assertNights(input.durationDays, input.durationNights);

    const slug = await this.uniqueSlug(input.title);

    const row = await this.prisma.package.create({
      data: {
        slug,
        title: input.title,
        summary: nullableText(input.summary) ?? null,
        description: nullableText(input.description) ?? null,
        destinationId: input.destinationId ?? null,
        durationDays: input.durationDays,
        durationNights: input.durationNights,
        priceMinor: input.priceMinor,
        currencyCode: input.currencyCode,
        heroImageUrl: input.heroImageUrl ?? null,
        inclusions: nullableText(input.inclusions) ?? null,
        exclusions: nullableText(input.exclusions) ?? null,
        featured: input.featured ?? false,
        status: "DRAFT",
        days: input.days?.length
          ? { create: input.days.map((day) => dayCreateInput(day)) }
          : undefined,
      },
      include: packageDetailInclude,
    });

    return this.toDetail(row);
  }

  async update(id: string, input: PackageUpdateInput): Promise<PackageDetail> {
    const existing = await this.prisma.package.findUnique({
      where: { id },
      include: packageDetailInclude,
    });
    if (!existing) throw ApiError.notFound("Package not found");

    if (input.destinationId !== undefined && input.destinationId !== null) {
      await this.assertDestination(input.destinationId);
    }
    this.assertUniqueDayNumbers(input.days);
    this.assertNights(
      input.durationDays ?? existing.durationDays,
      input.durationNights ?? existing.durationNights,
    );

    const data: Prisma.PackageUpdateInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.durationDays !== undefined) data.durationDays = input.durationDays;
    if (input.durationNights !== undefined) data.durationNights = input.durationNights;
    if (input.priceMinor !== undefined) data.priceMinor = input.priceMinor;
    if (input.currencyCode !== undefined) data.currencyCode = input.currencyCode;
    if (input.featured !== undefined) data.featured = input.featured;

    const summary = nullableText(input.summary);
    if (summary !== undefined) data.summary = summary;
    const description = nullableText(input.description);
    if (description !== undefined) data.description = description;
    const inclusions = nullableText(input.inclusions);
    if (inclusions !== undefined) data.inclusions = inclusions;
    const exclusions = nullableText(input.exclusions);
    if (exclusions !== undefined) data.exclusions = exclusions;
    if (input.heroImageUrl !== undefined) data.heroImageUrl = input.heroImageUrl;

    if (input.destinationId !== undefined) {
      data.destination =
        input.destinationId === null
          ? { disconnect: true }
          : { connect: { id: input.destinationId } };
    }

    if (input.days !== undefined) {
      data.days = {
        deleteMany: {},
        ...(input.days.length
          ? { create: input.days.map((day) => dayCreateInput(day)) }
          : {}),
      };
    }

    if (input.status !== undefined) {
      data.status = input.status;
      data.publishedAt =
        input.status === "PUBLISHED" ? existing.publishedAt ?? new Date() : null;
    }

    const row = await this.prisma.package.update({
      where: { id },
      data,
      include: packageDetailInclude,
    });

    return this.toDetail(row);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.package.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw ApiError.notFound("Package not found");
    await this.prisma.package.delete({ where: { id } });
  }

  // ─── Departures (D41): set-date journeys with seat counts ─────────────────

  /** Occupied seats per departure, from live bookings only - cancelled,
   * refunded and expired requests release their seats automatically because
   * they are simply not counted. */
  private async takenByDeparture(
    packageId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.packageBooking.groupBy({
      by: ["departureId"],
      where: {
        packageId,
        departureId: { not: null },
        status: { notIn: ["CANCELLED", "REFUNDED", "EXPIRED"] },
      },
      _sum: { adults: true, children: true },
    });
    const taken = new Map<string, number>();
    for (const row of rows) {
      if (row.departureId) {
        taken.set(row.departureId, (row._sum.adults ?? 0) + (row._sum.children ?? 0));
      }
    }
    return taken;
  }

  private toDeparture(
    row: { id: string; date: Date; seats: number },
    taken: Map<string, number>,
  ): PackageDepartureDto {
    return {
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      seats: row.seats,
      remaining: row.seats - (taken.get(row.id) ?? 0),
    };
  }

  /** Public list for the booking form: future dates with bookable seats,
   * soonest first. Full dates drop out (remaining <= 0). */
  async listPublicDepartures(slug: string): Promise<PackageDepartureDto[]> {
    const pkg = await this.prisma.package.findUnique({
      where: { slug, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!pkg) throw ApiError.notFound("Package not found");

    const [rows, taken] = await Promise.all([
      this.prisma.packageDeparture.findMany({
        where: { packageId: pkg.id, date: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        orderBy: { date: "asc" },
      }),
      this.takenByDeparture(pkg.id),
    ]);
    return rows
      .map((row) => this.toDeparture(row, taken))
      .filter((dep) => dep.remaining > 0);
  }

  /** Admin list: every departure of the package, past ones included so the
   * console can see history; remaining can go negative when seats were
   * trimmed below live bookings. */
  async listAdminDepartures(packageId: string): Promise<PackageDepartureDto[]> {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true },
    });
    if (!pkg) throw ApiError.notFound("Package not found");

    const [rows, taken] = await Promise.all([
      this.prisma.packageDeparture.findMany({
        where: { packageId },
        orderBy: { date: "asc" },
      }),
      this.takenByDeparture(packageId),
    ]);
    return rows.map((row) => this.toDeparture(row, taken));
  }

  private async createDepartures(
    packageId: string,
    dates: Date[],
    seats: number,
  ): Promise<PackageDepartureDto[]> {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true },
    });
    if (!pkg) throw ApiError.notFound("Package not found");

    // Sequential best-effort creates: a collision with an existing departure
    // (unique packageId+date) is skipped, not fatal - useful for the weekly
    // quick-add where some weeks may already exist.
    const created: PackageDepartureDto[] = [];
    for (const date of dates) {
      try {
        const row = await this.prisma.packageDeparture.create({
          data: { packageId, date, seats },
        });
        created.push(this.toDeparture(row, new Map()));
      } catch (error) {
        // P2002 = unique constraint violation: that date already has a row.
        if (
          typeof error === "object" &&
          error !== null &&
          (error as { code?: unknown }).code === "P2002"
        ) {
          continue;
        }
        throw error;
      }
    }
    return created;
  }

  async createDeparture(
    packageId: string,
    input: DepartureCreateInput,
  ): Promise<{ departures: PackageDepartureDto[] }> {
    const departures = await this.createDepartures(packageId, [input.startDate], input.seats);
    if (departures.length === 0) {
      throw ApiError.conflict(
        "That date already has a departure for this package",
        "DEPARTURE_DATE_EXISTS",
      );
    }
    return { departures };
  }

  async createDeparturesWeekly(
    packageId: string,
    input: DepartureBulkCreateInput,
  ): Promise<{ created: number; departures: PackageDepartureDto[] }> {
    // weeks=1 degenerates to the single-date create (the start week counts).
    const dates = Array.from({ length: input.weeks }, (_, week) =>
      new Date(input.startDate.getTime() + week * 7 * 24 * 60 * 60 * 1000),
    );
    const departures = await this.createDepartures(packageId, dates, input.seats);
    return { created: departures.length, departures };
  }

  /** Seat-count correction. The console cannot trim seats below the number
   * already held by live bookings - overbooked would be silent otherwise. */
  async updateDeparture(
    packageId: string,
    departureId: string,
    input: DepartureUpdateInput,
  ): Promise<{ departure: PackageDepartureDto }> {
    const departure = await this.prisma.packageDeparture.findUnique({
      where: { id: departureId },
    });
    if (!departure || departure.packageId !== packageId) {
      throw ApiError.notFound("Departure not found");
    }
    const taken = await this.takenByDeparture(packageId);
    const held = taken.get(departureId) ?? 0;
    if (input.seats < held) {
      throw ApiError.conflict(
        `${held} seat${held === 1 ? " is" : "s are"} already held by live bookings for that departure`,
        "DEPARTURE_SEATS_BELOW_BOOKED",
      );
    }
    const row = await this.prisma.packageDeparture.update({
      where: { id: departureId },
      data: { seats: input.seats },
    });
    return { departure: this.toDeparture(row, taken) };
  }

  /** Deleting a departure refuses while any live booking holds seats - the
   * release has to happen through the booking lifecycle, never silently. */
  async deleteDeparture(packageId: string, departureId: string): Promise<void> {
    const departure = await this.prisma.packageDeparture.findUnique({
      where: { id: departureId },
    });
    if (!departure || departure.packageId !== packageId) {
      throw ApiError.notFound("Departure not found");
    }
    const taken = await this.takenByDeparture(packageId);
    const held = taken.get(departureId) ?? 0;
    if (held > 0) {
      throw ApiError.conflict(
        "That departure still holds booked seats - cancel or move those bookings first",
        "DEPARTURE_HAS_BOOKINGS",
      );
    }
    await this.prisma.packageDeparture.delete({ where: { id: departureId } });
  }

  private toSummary(row: PackageSummaryRow): PackageSummary {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      destination: row.destination
        ? {
            id: row.destination.id,
            slug: row.destination.slug,
            name: row.destination.name,
            cityName: row.destination.city?.name ?? null,
            regionName: row.destination.city?.region?.name ?? null,
          }
        : null,
      durationDays: row.durationDays,
      durationNights: row.durationNights,
      priceMinor: row.priceMinor,
      currencyCode: row.currencyCode,
      heroImageUrl: row.heroImageUrl,
      status: row.status,
      featured: row.featured,
      dayCount: row._count.days,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDetail(row: PackageDetailRow): PackageDetail {
    return {
      ...this.toSummary(row),
      description: row.description,
      inclusions: row.inclusions,
      exclusions: row.exclusions,
      createdAt: row.createdAt.toISOString(),
      days: row.days.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        title: day.title,
        description: day.description,
        meals: day.meals,
        accommodation: day.accommodation,
      })),
    };
  }

  private async assertDestination(id: string): Promise<void> {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!destination) {
      throw ApiError.badRequest("Destination not found", "INVALID_DESTINATION");
    }
  }

  private assertUniqueDayNumbers(days?: { dayNumber: number }[]): void {
    if (!days) return;
    if (new Set(days.map((day) => day.dayNumber)).size !== days.length) {
      throw ApiError.badRequest("Day numbers must be unique", "INVALID_DAYS");
    }
  }

  private assertNights(durationDays: number, durationNights: number): void {
    if (durationNights >= durationDays) {
      throw ApiError.badRequest("Nights must be fewer than days", "INVALID_DURATION");
    }
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;

    for (
      let suffix = 2;
      await this.prisma.package.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      suffix += 1
    ) {
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }
}
