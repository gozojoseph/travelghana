import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@travelghana/database";
import type {
  EstimateSource,
  ItineraryItem,
  ItineraryItemType,
  PricingBasis,
  TripAttractionRef,
  TripDetail,
  TripDestinationRef,
  TripExperienceRef,
  TripPackageRef,
  TripShareStatus,
  TripShareView,
  TripSummary,
  TripTourRef,
} from "@travelghana/types";
import {
  MAX_TRIP_DAYS,
  type ItineraryDayCreateInput,
  type ItineraryDayUpdateInput,
  type ItineraryItemCreateInput,
  type ItineraryItemMoveInput,
  type ItineraryItemUpdateInput,
  type TravelerCreateInput,
  type TravelerUpdateInput,
  type TripCreateInput,
  type TripUpdateInput,
} from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";
import { primaryWebAppUrl } from "../../common/config/app-urls";
import { MAILER, Mailer } from "../mail/mailer";
import { tripPlanEmail } from "../mail/email-templates";
import {
  addDaysToDate,
  combineDayAndTime,
  dateOnlyDeltaDays,
  daysInclusive,
  formatDateOnly,
  parseDateOnly,
} from "./date-utils";
import { generateDaySeeds } from "./trip-days";
import { buildTripShareView, tripShareInclude } from "./trip-share";
import { computeTripSummary, type SummaryItemInput } from "./trip-summary";

/** Refs + estimate fields needed to render an item card / budget line. */
const itemInclude = {
  destination: {
    include: { city: { include: { region: true } } },
  },
  attraction: {
    include: {
      city: { select: { name: true } },
      destination: { select: { slug: true, name: true } },
    },
  },
  tour: {
    include: { provider: { select: { slug: true, name: true } } },
  },
  experience: {
    include: { provider: { select: { slug: true, name: true } } },
  },
  package: true,
} satisfies Prisma.ItineraryItemInclude;

const itemOrder = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];

/** Full graph needed to build a TripDetail DTO (scheduled + unscheduled items). */
const tripGraphInclude = {
  travelers: {
    include: { needs: true },
    orderBy: { id: "asc" as const },
  },
  items: {
    where: { itineraryDayId: null },
    orderBy: itemOrder,
    include: itemInclude,
  },
  days: {
    orderBy: { dayNumber: "asc" as const },
    include: {
      items: { orderBy: itemOrder, include: itemInclude },
    },
  },
} satisfies Prisma.TripInclude;

type TripGraph = Prisma.TripGetPayload<{ include: typeof tripGraphInclude }>;
type TripItemGraph = TripGraph["items"][number];

/** Plain shape the summary engine consumes (no Prisma/Date types). */
function toSummaryItem(item: TripItemGraph): SummaryItemInput {
  return {
    id: item.id,
    title: item.title,
    itemType: item.itemType as ItineraryItemType,
    startTime: item.startTime ? item.startTime.toISOString() : null,
    endTime: item.endTime ? item.endTime.toISOString() : null,
    estimatedCostMinor: item.estimatedCostMinor,
    currencyCode: item.currencyCode,
    pricingBasis: item.pricingBasis as PricingBasis | null,
  };
}

interface ResolvedEstimate {
  estimatedCostMinor: number | null;
  currencyCode: string | null;
  pricingBasis: PricingBasis | null;
  estimateSource: EstimateSource | null;
  priceSnapshotAt: Date | null;
}

interface ListingRefs {
  tourId?: string | null;
  experienceId?: string | null;
  packageId?: string | null;
}

/**
 * Trip + itinerary planner (ARCHITECTURE.md step 5, D12/D18).
 *
 * Owner-scoped: every route resolves the trip by `ownerUserId` first, and
 * missing vs. foreign ids return the same 404 (no existence oracle). Mutations
 * return the full updated trip so the web `TripsSource` implementation stays a
 * straight swap.
 *
 * Day rules: generated from trip dates (max 30), extended by appending, never
 * auto-deleted; only empty days can be deleted and the remainder is renumbered.
 * A start-date move shifts existing day dates and item times by the same delta.
 *
 * Items may also live in a trip-level unscheduled list (`itineraryDayId` null).
 * Estimates are snapshots/inputs for budgeting only — never confirmed prices.
 */
@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  // ─── Trips ──────────────────────────────────────────────────────────────────

  async listTrips(userId: string): Promise<TripSummary[]> {
    const trips = await this.prisma.trip.findMany({
      where: { ownerUserId: userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        _count: {
          select: {
            travelers: true,
            days: true,
            items: { where: { itineraryDayId: null } },
          },
        },
        days: { select: { _count: { select: { items: true } } } },
      },
    });

    return trips.map((trip) => {
      const scheduledItemCount = trip.days.reduce(
        (total, day) => total + day._count.items,
        0,
      );
      return {
        id: trip.id,
        name: trip.name,
        startDate: trip.startDate ? formatDateOnly(trip.startDate) : null,
        endDate: trip.endDate ? formatDateOnly(trip.endDate) : null,
        status: trip.status,
        adults: trip.adults,
        children: trip.children,
        budgetMinor: trip.budgetMinor,
        currencyCode: trip.currencyCode,
        travelPace: trip.travelPace,
        budgetTier: trip.budgetTier,
        dayCount: trip._count.days,
        travelerCount: trip._count.travelers,
        itemCount: scheduledItemCount + trip._count.items,
        unscheduledItemCount: trip._count.items,
        updatedAt: trip.updatedAt.toISOString(),
      };
    });
  }

  async getTrip(userId: string, tripId: string): Promise<TripDetail> {
    return this.toDetail(await this.getTripGraph(userId, tripId));
  }

  async createTrip(userId: string, input: TripCreateInput): Promise<TripDetail> {
    const startDate = input.startDate ? parseDateOnly(input.startDate) : null;
    const endDate = input.endDate ? parseDateOnly(input.endDate) : null;
    const daySeeds = generateDaySeeds(startDate, endDate);
    const destinationPreferences = await this.assertDestinationPreferences(
      input.destinationPreferences,
    );

    const trip = await this.prisma.trip.create({
      data: {
        ownerUserId: userId,
        name: input.name,
        startDate,
        endDate,
        adults: input.adults,
        children: input.children,
        budgetMinor: input.budgetMinor ?? null,
        currencyCode: input.currencyCode,
        notes: input.notes ?? null,
        interests: input.interests,
        travelPace: input.travelPace,
        budgetTier: input.budgetTier,
        budgetType: input.budgetType,
        budgetIncludesFlights: input.budgetIncludesFlights,
        arrivalPoint: input.arrivalPoint || null,
        destinationPreferences,
        days: { create: daySeeds },
      },
      select: { id: true },
    });

    // D36: an acknowledgement email when a traveler saves a new trip plan.
    // Failure-tolerant by the Mailer contract - planning never blocks on mail.
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (owner) {
      const fmt = (value: Date): string =>
        value.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        });
      const datesLabel =
        startDate && endDate ? `${fmt(startDate)} to ${fmt(endDate)}` : "No dates chosen yet";
      const party = `${input.adults} ${input.adults === 1 ? "adult" : "adults"}${
        input.children > 0
          ? `, ${input.children} ${input.children === 1 ? "child" : "children"}`
          : ""
      }`;
      await this.mailer.send({
        to: owner.email,
        ...tripPlanEmail({
          name: owner.name,
          tripName: input.name,
          datesLabel,
          party,
          url: `${primaryWebAppUrl()}/trips`,
        }),
      });
    }

    return this.getTrip(userId, trip.id);
  }

  async updateTrip(
    userId: string,
    tripId: string,
    input: TripUpdateInput,
  ): Promise<TripDetail> {
    const trip = await this.ownTrip(userId, tripId);

    // Update schemas are partial, so cross-field date rules are checked against
    // the merged state (same rules as the create form / demo source).
    const nextStartDate =
      input.startDate !== undefined
        ? input.startDate
          ? parseDateOnly(input.startDate)
          : null
        : trip.startDate;
    const nextEndDate =
      input.endDate !== undefined
        ? input.endDate
          ? parseDateOnly(input.endDate)
          : null
        : trip.endDate;

    if (nextEndDate && !nextStartDate) {
      throw ApiError.badRequest(
        "Add a start date before the end date",
        "INVALID_TRIP_DATES",
      );
    }
    if (nextStartDate && nextEndDate) {
      if (nextEndDate < nextStartDate) {
        throw ApiError.badRequest(
          "The end date must be on or after the start date",
          "INVALID_TRIP_DATES",
        );
      }
      if (daysInclusive(nextStartDate, nextEndDate) > MAX_TRIP_DAYS) {
        throw ApiError.badRequest(
          `Trips can span at most ${MAX_TRIP_DAYS} days`,
          "TRIP_TOO_LONG",
        );
      }
    }

    const destinationPreferences =
      input.destinationPreferences !== undefined
        ? await this.assertDestinationPreferences(input.destinationPreferences)
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.TripUpdateInput = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.adults !== undefined) data.adults = input.adults;
      if (input.children !== undefined) data.children = input.children;
      if (input.budgetMinor !== undefined) data.budgetMinor = input.budgetMinor;
      if (input.currencyCode !== undefined) data.currencyCode = input.currencyCode;
      if (input.notes !== undefined) data.notes = input.notes;
      if (input.interests !== undefined) data.interests = input.interests;
      if (input.travelPace !== undefined) data.travelPace = input.travelPace;
      if (input.budgetTier !== undefined) data.budgetTier = input.budgetTier;
      if (input.budgetType !== undefined) data.budgetType = input.budgetType;
      if (input.budgetIncludesFlights !== undefined) {
        data.budgetIncludesFlights = input.budgetIncludesFlights;
      }
      if (input.arrivalPoint !== undefined) data.arrivalPoint = input.arrivalPoint || null;
      if (destinationPreferences !== undefined) {
        data.destinationPreferences = destinationPreferences;
      }
      if (input.startDate !== undefined) data.startDate = nextStartDate;
      if (input.endDate !== undefined) data.endDate = nextEndDate;

      await tx.trip.update({ where: { id: trip.id }, data });

      if (nextStartDate && nextEndDate) {
        await this.syncDays(tx, trip.id, trip.startDate, nextStartDate, nextEndDate);
      } else if (
        nextStartDate &&
        trip.startDate &&
        nextStartDate.getTime() !== trip.startDate.getTime()
      ) {
        // Start moved but there is no end date: shift existing day dates only.
        await this.shiftDays(tx, trip.id, dateOnlyDeltaDays(trip.startDate, nextStartDate));
      }
    });

    return this.getTrip(userId, tripId);
  }

  async deleteTrip(userId: string, tripId: string): Promise<void> {
    await this.ownTrip(userId, tripId);
    await this.prisma.trip.delete({ where: { id: tripId } });
  }

  // ─── Travelers + sensitive needs (§11) ──────────────────────────────────────

  async addTraveler(
    userId: string,
    tripId: string,
    input: TravelerCreateInput,
  ): Promise<TripDetail> {
    await this.ownTrip(userId, tripId);

    await this.prisma.tripTraveler.create({
      data: {
        tripId,
        name: input.name || null,
        ageGroup: input.ageGroup || null,
        needs: {
          create: input.needs.map((need) => ({
            category: need.category,
            details: need.details || null,
            // Owner-private until provider sharing ships (D12, question #14):
            // explicit here, not just schema defaults, so the privacy posture is
            // obvious to reviewers.
            consentGivenAt: null,
            providerVisibility: "NONE",
            detailsVisibleToProviders: false,
          })),
        },
      },
    });

    return this.getTrip(userId, tripId);
  }

  async updateTraveler(
    userId: string,
    tripId: string,
    travelerId: string,
    input: TravelerUpdateInput,
  ): Promise<TripDetail> {
    await this.ownTrip(userId, tripId);
    await this.ownTraveler(tripId, travelerId);

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.TripTravelerUpdateInput = {};
      if (input.name !== undefined) data.name = input.name || null;
      if (input.ageGroup !== undefined) data.ageGroup = input.ageGroup || null;
      if (Object.keys(data).length > 0) {
        await tx.tripTraveler.update({ where: { id: travelerId }, data });
      }

      if (input.needs !== undefined) {
        // Needs are replaced wholesale (the UI edits a flat list); ids are not
        // exposed to clients, and any previous consent is deliberately revived
        // as NONE when the details change.
        await tx.travelerNeed.deleteMany({ where: { tripTravelerId: travelerId } });
        if (input.needs.length > 0) {
          await tx.travelerNeed.createMany({
            data: input.needs.map((need) => ({
              tripTravelerId: travelerId,
              category: need.category,
              details: need.details || null,
              consentGivenAt: null,
              providerVisibility: "NONE",
              detailsVisibleToProviders: false,
            })),
          });
        }
      }
    });

    return this.getTrip(userId, tripId);
  }

  async removeTraveler(
    userId: string,
    tripId: string,
    travelerId: string,
  ): Promise<TripDetail> {
    await this.ownTrip(userId, tripId);
    await this.ownTraveler(tripId, travelerId);
    await this.prisma.tripTraveler.delete({ where: { id: travelerId } });
    return this.getTrip(userId, tripId);
  }

  // ─── Itinerary days ─────────────────────────────────────────────────────────

  async addDay(
    userId: string,
    tripId: string,
    input: ItineraryDayCreateInput,
  ): Promise<TripDetail> {
    const trip = await this.ownTrip(userId, tripId);
    const days = await this.prisma.itineraryDay.findMany({
      where: { tripId },
      select: { dayNumber: true, date: true },
      orderBy: { dayNumber: "asc" },
    });

    const lastDate = days.reduce<Date | null>((latest, day) => {
      if (!day.date) return latest;
      return !latest || day.date > latest ? day.date : latest;
    }, null);
    const date = lastDate ? addDaysToDate(lastDate, 1) : trip.startDate;
    const dayNumber = days.reduce((max, day) => Math.max(max, day.dayNumber), 0) + 1;

    await this.prisma.itineraryDay.create({
      data: {
        tripId,
        dayNumber,
        date,
        title: input.title || null,
        notes: input.notes || null,
      },
    });

    return this.getTrip(userId, tripId);
  }

  async updateDay(
    userId: string,
    tripId: string,
    dayId: string,
    input: ItineraryDayUpdateInput,
  ): Promise<TripDetail> {
    await this.ownTrip(userId, tripId);
    await this.ownDay(tripId, dayId);

    const data: Prisma.ItineraryDayUpdateInput = {};
    if (input.title !== undefined) data.title = input.title || null;
    if (input.notes !== undefined) data.notes = input.notes || null;
    await this.prisma.itineraryDay.update({ where: { id: dayId }, data });

    return this.getTrip(userId, tripId);
  }

  async removeDay(
    userId: string,
    tripId: string,
    dayId: string,
  ): Promise<TripDetail> {
    await this.ownTrip(userId, tripId);
    const day = await this.ownDay(tripId, dayId);
    if (day._count.items > 0) {
      throw ApiError.badRequest(
        "Remove the activities in this day first",
        "DAY_NOT_EMPTY",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.itineraryDay.delete({ where: { id: dayId } });
      const remaining = await tx.itineraryDay.findMany({
        where: { tripId },
        orderBy: { dayNumber: "asc" },
        select: { id: true },
      });

      // Two-phase renumber: the @@unique([tripId, dayNumber]) constraint would
      // reject a direct 3→2 move while day 2 still exists. Park every row in a
      // disjoint negative range first, then assign 1..N.
      let index = 0;
      for (const row of remaining) {
        await tx.itineraryDay.update({
          where: { id: row.id },
          data: { dayNumber: -(index + 1) },
        });
        index += 1;
      }
      index = 0;
      for (const row of remaining) {
        await tx.itineraryDay.update({
          where: { id: row.id },
          data: { dayNumber: index + 1 },
        });
        index += 1;
      }
    });

    return this.getTrip(userId, tripId);
  }

  // ─── Itinerary items ────────────────────────────────────────────────────────

  async addItem(
    userId: string,
    tripId: string,
    dayId: string,
    input: ItineraryItemCreateInput,
  ): Promise<TripDetail> {
    await this.ownTrip(userId, tripId);
    const day = await this.prisma.itineraryDay.findUnique({
      where: { id: dayId },
      select: {
        id: true,
        tripId: true,
        date: true,
        items: { select: { sortOrder: true } },
      },
    });
    if (!day || day.tripId !== tripId) {
      throw ApiError.notFound("Itinerary day not found", "DAY_NOT_FOUND");
    }

    const sortOrder = day.items.reduce(
      (max, item) => Math.max(max, item.sortOrder + 1),
      0,
    );

    await this.prisma.itineraryItem.create({
      data: {
        tripId,
        itineraryDayId: dayId,
        title: input.title,
        itemType: input.itemType,
        sortOrder,
        startTime:
          day.date && input.startTime
            ? combineDayAndTime(day.date, input.startTime)
            : null,
        endTime:
          day.date && input.endTime ? combineDayAndTime(day.date, input.endTime) : null,
        notes: input.notes ?? null,
        ...(await this.resolveItemWrite(input)),
      },
    });

    return this.getTrip(userId, tripId);
  }

  /** Add an idea to the trip-level unscheduled list (no day yet). */
  async addUnscheduledItem(
    userId: string,
    tripId: string,
    input: ItineraryItemCreateInput,
  ): Promise<TripDetail> {
    await this.ownTrip(userId, tripId);
    if (input.startTime || input.endTime) {
      throw ApiError.badRequest(
        "Assign the activity to a day before setting a time",
        "ASSIGN_DAY_FOR_TIME",
      );
    }

    const last = await this.prisma.itineraryItem.findFirst({
      where: { tripId, itineraryDayId: null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

        await this.prisma.itineraryItem.create({
      data: {
        tripId,
        itineraryDayId: null,
        title: input.title,
        itemType: input.itemType,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        startTime: null,
        endTime: null,
        notes: input.notes ?? null,
        ...(await this.resolveItemWrite(input)),
      },
    });

    return this.getTrip(userId, tripId);
  }

  async updateItem(
    userId: string,
    tripId: string,
    itemId: string,
    input: ItineraryItemUpdateInput,
  ): Promise<TripDetail> {
    await this.ownTrip(userId, tripId);
    const item = await this.ownItem(tripId, itemId);

    const data: Prisma.ItineraryItemUncheckedUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.itemType !== undefined) data.itemType = input.itemType;
    if (input.notes !== undefined) data.notes = input.notes || null;

    if (input.destinationId !== undefined) {
      data.destinationId = await this.assertDestination(input.destinationId);
    }
    if (input.attractionId !== undefined) {
      data.attractionId = await this.assertAttraction(input.attractionId);
    }

    if (input.startTime !== undefined || input.endTime !== undefined) {
      const nextStart = input.startTime !== undefined ? input.startTime : undefined;
      const nextEnd = input.endTime !== undefined ? input.endTime : undefined;
      if (!item.itineraryDayId && (nextStart || nextEnd)) {
        throw ApiError.badRequest(
          "Assign the activity to a day before setting a time",
          "ASSIGN_DAY_FOR_TIME",
        );
      }
      const dayDate = item.day?.date ?? null;
      if (nextStart !== undefined) {
        data.startTime =
          dayDate && nextStart ? combineDayAndTime(dayDate, nextStart) : null;
      }
      if (nextEnd !== undefined) {
        data.endTime = dayDate && nextEnd ? combineDayAndTime(dayDate, nextEnd) : null;
      }
    }

    const touchesEstimate =
      input.tourId !== undefined ||
      input.experienceId !== undefined ||
      input.packageId !== undefined ||
      input.estimatedCostMinor !== undefined ||
      input.currencyCode !== undefined ||
      input.pricingBasis !== undefined ||
      input.estimateSource !== undefined;

    if (touchesEstimate) {
      const merged = {
        tourId:
          input.tourId !== undefined ? input.tourId : item.tourId,
        experienceId:
          input.experienceId !== undefined ? input.experienceId : item.experienceId,
        packageId:
          input.packageId !== undefined ? input.packageId : item.packageId,
        estimatedCostMinor:
          input.estimatedCostMinor !== undefined
            ? input.estimatedCostMinor
            : item.estimatedCostMinor,
        currencyCode:
          input.currencyCode !== undefined ? input.currencyCode : item.currencyCode,
        pricingBasis:
          input.pricingBasis !== undefined ? input.pricingBasis : item.pricingBasis,
        estimateSource:
          input.estimateSource !== undefined
            ? input.estimateSource
            : item.estimateSource,
      };
      const estimate = await this.resolveEstimate(merged);
      data.tourId = merged.tourId;
      data.experienceId = merged.experienceId;
      data.packageId = merged.packageId;
      data.estimatedCostMinor = estimate.estimatedCostMinor;
      data.currencyCode = estimate.currencyCode;
      data.pricingBasis = estimate.pricingBasis;
      data.estimateSource = estimate.estimateSource;
      data.priceSnapshotAt = estimate.priceSnapshotAt;
    }

    await this.prisma.itineraryItem.update({ where: { id: item.id }, data });
    return this.getTrip(userId, tripId);
  }

  async removeItem(
    userId: string,
    tripId: string,
    itemId: string,
  ): Promise<TripDetail> {
    await this.ownTrip(userId, tripId);
    const item = await this.ownItem(tripId, itemId);

    await this.prisma.$transaction(async (tx) => {
      await tx.itineraryItem.delete({ where: { id: item.id } });
      const remaining = await tx.itineraryItem.findMany({
        where: { tripId, itineraryDayId: item.itineraryDayId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      let index = 0;
      for (const row of remaining) {
        await tx.itineraryItem.update({
          where: { id: row.id },
          data: { sortOrder: index },
        });
        index += 1;
      }
    });

    return this.getTrip(userId, tripId);
  }

  async reorderItems(
    userId: string,
    tripId: string,
    dayId: string,
    itemIds: string[],
  ): Promise<TripDetail> {
    await this.ownTrip(userId, tripId);
    const day = await this.prisma.itineraryDay.findUnique({
      where: { id: dayId },
      select: { id: true, tripId: true, items: { select: { id: true } } },
    });
    if (!day || day.tripId !== tripId) {
      throw ApiError.notFound("Itinerary day not found", "DAY_NOT_FOUND");
    }

    this.assertCompleteReorder(day.items.map((item) => item.id), itemIds);
    await this.applyReorder(itemIds);

    return this.getTrip(userId, tripId);
  }

  /** Reorder the trip-level unscheduled list. */
  async reorderUnscheduledItems(
    userId: string,
    tripId: string,
    itemIds: string[],
  ): Promise<TripDetail> {
    await this.ownTrip(userId, tripId);
    const items = await this.prisma.itineraryItem.findMany({
      where: { tripId, itineraryDayId: null },
      select: { id: true },
    });

    this.assertCompleteReorder(items.map((item) => item.id), itemIds);
    await this.applyReorder(itemIds);

    return this.getTrip(userId, tripId);
  }

  /**
   * Move an item between days, or into / out of the unscheduled list.
   *
   * Timed items are rebased onto the target day's date (the stored timestamp is
   * date + HH:mm). Moving to an undated day or the unscheduled list clears the
   * times — there is no date to anchor them to, and we do not invent one.
   */
  async moveItem(
    userId: string,
    tripId: string,
    itemId: string,
    input: ItineraryItemMoveInput,
  ): Promise<TripDetail> {
    await this.ownTrip(userId, tripId);
    const item = await this.ownItem(tripId, itemId);

    let targetDay: { id: string; date: Date | null } | null = null;
    if (input.dayId) {
      const day = await this.prisma.itineraryDay.findUnique({
        where: { id: input.dayId },
        select: { id: true, tripId: true, date: true },
      });
      if (!day || day.tripId !== tripId) {
        throw ApiError.notFound("Itinerary day not found", "DAY_NOT_FOUND");
      }
      targetDay = { id: day.id, date: day.date };
    }

    const startClock = item.startTime ? item.startTime.toISOString().slice(11, 16) : null;
    const endClock = item.endTime ? item.endTime.toISOString().slice(11, 16) : null;
    const startTime =
      targetDay?.date && startClock ? combineDayAndTime(targetDay.date, startClock) : null;
    const endTime =
      targetDay?.date && endClock ? combineDayAndTime(targetDay.date, endClock) : null;

    const sourceDayId = item.itineraryDayId;
    const destinationDayId = targetDay?.id ?? null;

    await this.prisma.$transaction(async (tx) => {
      const targetRows = await tx.itineraryItem.findMany({
        where: {
          tripId,
          itineraryDayId: destinationDayId,
          id: { not: item.id },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });

      const targetIds = targetRows.map((row) => row.id);
      const position = Math.min(
        Math.max(input.position ?? targetIds.length, 0),
        targetIds.length,
      );
      targetIds.splice(position, 0, item.id);

      await tx.itineraryItem.update({
        where: { id: item.id },
        data: {
          itineraryDayId: destinationDayId,
          startTime,
          endTime,
        },
      });

      let order = 0;
      for (const id of targetIds) {
        await tx.itineraryItem.update({
          where: { id },
          data: { sortOrder: order },
        });
        order += 1;
      }

      // Close the gap in the source list when the item changed lists.
      if (sourceDayId !== destinationDayId) {
        const sourceRows = await tx.itineraryItem.findMany({
          where: { tripId, itineraryDayId: sourceDayId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true },
        });
        let index = 0;
        for (const row of sourceRows) {
          await tx.itineraryItem.update({
            where: { id: row.id },
            data: { sortOrder: index },
          });
          index += 1;
        }
      }
    });

    return this.getTrip(userId, tripId);
  }

  // ─── Item write helpers ─────────────────────────────────────────────────────

  /**
   * Validate/derive all item link fields + the estimate snapshot for a create.
   *
   * Listing prices are authoritative in the backend: when an item links a
   * published tour/experience/package and the estimate is not explicitly
   * manual, the stored estimate is copied from the listing at write time and
   * labelled as a snapshot. Manual estimates keep the traveler's number.
   */
  private async resolveItemWrite(input: ItineraryItemCreateInput): Promise<{
    destinationId: string | null;
    attractionId: string | null;
    tourId: string | null;
    experienceId: string | null;
    packageId: string | null;
    estimatedCostMinor: number | null;
    currencyCode: string | null;
    pricingBasis: PricingBasis | null;
    estimateSource: EstimateSource | null;
    priceSnapshotAt: Date | null;
  }> {
    const estimate = await this.resolveEstimate({
      tourId: input.tourId,
      experienceId: input.experienceId,
      packageId: input.packageId,
      estimatedCostMinor: input.estimatedCostMinor,
      currencyCode: input.currencyCode,
      pricingBasis: input.pricingBasis,
      estimateSource: input.estimateSource,
    });

    return {
      destinationId: await this.assertDestination(input.destinationId),
      attractionId: await this.assertAttraction(input.attractionId),
      tourId: input.tourId ?? null,
      experienceId: input.experienceId ?? null,
      packageId: input.packageId ?? null,
      ...estimate,
    };
  }

  private async resolveEstimate(input: {
    tourId?: string | null;
    experienceId?: string | null;
    packageId?: string | null;
    estimatedCostMinor?: number | null;
    currencyCode?: string | null;
    pricingBasis?: PricingBasis | null;
    estimateSource?: EstimateSource | null;
  }): Promise<ResolvedEstimate> {
    const listing = await this.loadListingPrice(input);
    const manual = input.estimateSource === "MANUAL";

    if (listing && !manual) {
      return {
        estimatedCostMinor: listing.priceMinor,
        currencyCode: listing.currencyCode,
        // Listings do not declare a charging basis; per-service is the neutral
        // default (the UI asks the traveler to change it where needed).
        pricingBasis: input.pricingBasis ?? "PER_SERVICE",
        estimateSource: "LISTING",
        priceSnapshotAt: new Date(),
      };
    }

    if (input.estimatedCostMinor === null || input.estimatedCostMinor === undefined) {
      return {
        estimatedCostMinor: null,
        currencyCode: null,
        pricingBasis: null,
        estimateSource: null,
        priceSnapshotAt: null,
      };
    }

    if (!input.pricingBasis) {
      throw ApiError.badRequest(
        "Choose how the estimate is charged (per person, per night, …)",
        "PRICING_BASIS_REQUIRED",
      );
    }

    return {
      estimatedCostMinor: input.estimatedCostMinor,
      currencyCode: input.currencyCode ?? null,
      pricingBasis: input.pricingBasis,
      estimateSource: "MANUAL",
      priceSnapshotAt: null,
    };
  }

  /** Loads the linked listing (published only) and returns its current price. */
  private async loadListingPrice(input: ListingRefs): Promise<{
    priceMinor: number;
    currencyCode: string;
  } | null> {
    const linked = [input.tourId, input.experienceId, input.packageId].filter(
      (value): value is string => Boolean(value),
    );
    if (linked.length > 1) {
      throw ApiError.badRequest(
        "Link only one marketplace listing per activity",
        "MULTIPLE_LISTINGS",
      );
    }

    if (input.tourId) {
      const tour = await this.prisma.tour.findFirst({
        where: { id: input.tourId, published: true },
        select: { basePriceMinor: true, currencyCode: true },
      });
      if (!tour) throw ApiError.badRequest("Tour is not available", "TOUR_NOT_FOUND");
      return { priceMinor: tour.basePriceMinor, currencyCode: tour.currencyCode };
    }

    if (input.experienceId) {
      const experience = await this.prisma.experience.findFirst({
        where: { id: input.experienceId, published: true },
        select: { priceMinor: true, currencyCode: true },
      });
      if (!experience) {
        throw ApiError.badRequest("Experience is not available", "EXPERIENCE_NOT_FOUND");
      }
      return {
        priceMinor: experience.priceMinor,
        currencyCode: experience.currencyCode,
      };
    }

    if (input.packageId) {
      const pkg = await this.prisma.package.findFirst({
        where: { id: input.packageId, status: "PUBLISHED" },
        select: { priceMinor: true, currencyCode: true },
      });
      if (!pkg) {
        throw ApiError.badRequest("Package is not available", "PACKAGE_NOT_FOUND");
      }
      return { priceMinor: pkg.priceMinor, currencyCode: pkg.currencyCode };
    }

    return null;
  }

  // ─── Sharing (D19: sanitized companion view) ─────────────────────────────

  /** Owner-facing share state for the workspace panel. */
  async shareStatus(userId: string, tripId: string): Promise<TripShareStatus> {
    await this.ownTrip(userId, tripId);
    const row = await this.prisma.tripShare.findFirst({
      where: { tripId, revokedAt: null },
      select: { token: true },
    });
    return row
      ? { active: true, path: `/share/${row.token}` }
      : { active: false, path: null };
  }

  /** Mints a fresh link; creating a share revokes the previous active one. */
  async createShare(userId: string, tripId: string): Promise<TripShareStatus> {
    await this.ownTrip(userId, tripId);
    const token = randomBytes(24).toString("base64url");
    await this.prisma.$transaction(async (tx) => {
      await tx.tripShare.updateMany({
        where: { tripId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.tripShare.create({ data: { tripId, token } });
    });
    return { active: true, path: `/share/${token}` };
  }

  /** Killing a link must kill it everywhere — the stamped revocation does. */
  async revokeShare(userId: string, tripId: string): Promise<TripShareStatus> {
    await this.ownTrip(userId, tripId);
    await this.prisma.tripShare.updateMany({
      where: { tripId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { active: false, path: null };
  }

  /**
   * Fetch a trip through a share token and render the sanitized companion
   * view (D19). Revoked/unknown tokens fail closed as 404 — they do not leak
   * whether the link ever existed.
   */
  async getSharedByToken(token: string): Promise<TripShareView> {
    const share = await this.prisma.tripShare.findUnique({
      where: { token },
      select: {
        revokedAt: true,
        trip: { include: tripShareInclude },
      },
    });
    if (!share || share.revokedAt) {
      throw ApiError.notFound("This shared trip is unavailable", "SHARE_NOT_FOUND");
    }
    return buildTripShareView(share.trip);
  }

  private assertCompleteReorder(knownIds: string[], itemIds: string[]): void {
    const known = new Set(knownIds);
    if (itemIds.length !== knownIds.length || itemIds.some((id) => !known.has(id))) {
      throw ApiError.badRequest(
        "The reordered list must include every activity once",
        "INVALID_REORDER",
      );
    }
  }

  private async applyReorder(itemIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      let index = 0;
      for (const itemId of itemIds) {
        await tx.itineraryItem.update({
          where: { id: itemId },
          data: { sortOrder: index },
        });
        index += 1;
      }
    });
  }

  // ─── Date/day synchronisation ───────────────────────────────────────────────

  private async shiftDays(
    tx: Prisma.TransactionClient,
    tripId: string,
    deltaDays: number,
  ): Promise<void> {
    if (deltaDays === 0) return;

    const days = await tx.itineraryDay.findMany({
      where: { tripId, date: { not: null } },
      select: {
        id: true,
        date: true,
        items: { select: { id: true, startTime: true, endTime: true } },
      },
    });

    for (const day of days) {
      if (day.date) {
        await tx.itineraryDay.update({
          where: { id: day.id },
          data: { date: addDaysToDate(day.date, deltaDays) },
        });
      }
      for (const item of day.items) {
        if (!item.startTime && !item.endTime) continue;
        await tx.itineraryItem.update({
          where: { id: item.id },
          data: {
            startTime: item.startTime ? addDaysToDate(item.startTime, deltaDays) : null,
            endTime: item.endTime ? addDaysToDate(item.endTime, deltaDays) : null,
          },
        });
      }
    }
  }

  /**
   * Applies a (possibly changed) start/end window:
   * - moves existing dates/times when the start shifts,
   * - dates the lone undated day when dates are added for the first time,
   * - appends missing trailing dates (never inserts or deletes).
   */
  private async syncDays(
    tx: Prisma.TransactionClient,
    tripId: string,
    oldStart: Date | null,
    newStart: Date,
    newEnd: Date,
  ): Promise<void> {
    if (oldStart && oldStart.getTime() !== newStart.getTime()) {
      await this.shiftDays(tx, tripId, dateOnlyDeltaDays(oldStart, newStart));
    }

    const days = await tx.itineraryDay.findMany({
      where: { tripId },
      select: { id: true, dayNumber: true, date: true },
      orderBy: { dayNumber: "asc" },
    });

    const first = days[0];
    if (days.length === 1 && first && !first.date) {
      await tx.itineraryDay.update({
        where: { id: first.id },
        data: { date: newStart },
      });
      first.date = newStart;
    }

    const existingDates = new Set(
      days
        .map((day) => day.date)
        .filter((date): date is Date => date !== null)
        .map(formatDateOnly),
    );
    const lastDate = days.reduce<Date | null>((latest, day) => {
      if (!day.date) return latest;
      return !latest || day.date > latest ? day.date : latest;
    }, null);
    let dayNumber = days.reduce((max, day) => Math.max(max, day.dayNumber), 0);

    const seeds: { dayNumber: number; date: Date }[] = [];
    for (let index = 0; index < daysInclusive(newStart, newEnd); index += 1) {
      const date = addDaysToDate(newStart, index);
      if (existingDates.has(formatDateOnly(date))) continue;
      if (lastDate && date <= lastDate) continue;
      dayNumber += 1;
      seeds.push({ dayNumber, date });
    }

    if (seeds.length > 0) {
      await tx.itineraryDay.createMany({
        data: seeds.map((seed) => ({ ...seed, tripId })),
      });
    }
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private async ownTrip(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.ownerUserId !== userId) {
      // Same answer for missing and not-yours: no existence oracle (§40).
      throw ApiError.notFound("Trip not found", "TRIP_NOT_FOUND");
    }
    return trip;
  }

  private async getTripGraph(userId: string, tripId: string): Promise<TripGraph> {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, ownerUserId: userId },
      include: tripGraphInclude,
    });
    if (!trip) throw ApiError.notFound("Trip not found", "TRIP_NOT_FOUND");
    return trip;
  }

  private async ownTraveler(tripId: string, travelerId: string) {
    const traveler = await this.prisma.tripTraveler.findUnique({
      where: { id: travelerId },
    });
    if (!traveler || traveler.tripId !== tripId) {
      throw ApiError.notFound("Traveler not found", "TRAVELER_NOT_FOUND");
    }
    return traveler;
  }

  private async ownDay(tripId: string, dayId: string) {
    const day = await this.prisma.itineraryDay.findUnique({
      where: { id: dayId },
      include: { _count: { select: { items: true } } },
    });
    if (!day || day.tripId !== tripId) {
      throw ApiError.notFound("Itinerary day not found", "DAY_NOT_FOUND");
    }
    return day;
  }

  private async ownItem(tripId: string, itemId: string) {
    const item = await this.prisma.itineraryItem.findUnique({
      where: { id: itemId },
      include: { day: { select: { date: true } } },
    });
    if (!item || item.tripId !== tripId) {
      throw ApiError.notFound("Itinerary item not found", "ITEM_NOT_FOUND");
    }
    return item;
  }

  private async assertDestination(
    destinationId: string | null | undefined,
  ): Promise<string | null> {
    if (!destinationId) return null;
    const destination = await this.prisma.destination.findUnique({
      where: { id: destinationId },
      select: { id: true },
    });
    if (!destination) {
      throw ApiError.badRequest("Unknown destination", "DESTINATION_NOT_FOUND");
    }
    return destination.id;
  }

  private async assertAttraction(
    attractionId: string | null | undefined,
  ): Promise<string | null> {
    if (!attractionId) return null;
    const attraction = await this.prisma.attraction.findUnique({
      where: { id: attractionId },
      select: { id: true },
    });
    if (!attraction) {
      throw ApiError.badRequest("Unknown attraction", "ATTRACTION_NOT_FOUND");
    }
    return attraction.id;
  }

  private async assertDestinationPreferences(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const unique = [...new Set(ids)];
    const found = await this.prisma.destination.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw ApiError.badRequest(
        "One or more preferred destinations were not found",
        "DESTINATION_NOT_FOUND",
      );
    }
    return unique;
  }

  private toItem(item: TripItemGraph): ItineraryItem {
    const destination: TripDestinationRef | null = item.destination
      ? {
          id: item.destination.id,
          slug: item.destination.slug,
          name: item.destination.name,
          cityName: item.destination.city?.name ?? null,
          regionName: item.destination.city?.region?.name ?? null,
        }
      : null;

    const attraction: TripAttractionRef | null = item.attraction
      ? {
          id: item.attraction.id,
          slug: item.attraction.slug,
          name: item.attraction.name,
          category: item.attraction.category,
          cityName: item.attraction.city?.name ?? null,
          destination: item.attraction.destination
            ? {
                slug: item.attraction.destination.slug,
                name: item.attraction.destination.name,
              }
            : null,
        }
      : null;

    const tour: TripTourRef | null = item.tour
      ? {
          id: item.tour.id,
          slug: item.tour.slug,
          title: item.tour.title,
          providerSlug: item.tour.provider.slug,
          providerName: item.tour.provider.name,
          priceMinor: item.tour.basePriceMinor,
          currencyCode: item.tour.currencyCode,
          durationHours: item.tour.durationHours,
          days: item.tour.days,
        }
      : null;

    const experience: TripExperienceRef | null = item.experience
      ? {
          id: item.experience.id,
          slug: item.experience.slug,
          title: item.experience.title,
          providerSlug: item.experience.provider.slug,
          providerName: item.experience.provider.name,
          priceMinor: item.experience.priceMinor,
          currencyCode: item.experience.currencyCode,
          durationMinutes: item.experience.durationMinutes,
        }
      : null;

    const pkg: TripPackageRef | null = item.package
      ? {
          id: item.package.id,
          slug: item.package.slug,
          title: item.package.title,
          durationDays: item.package.durationDays,
          durationNights: item.package.durationNights,
          priceMinor: item.package.priceMinor,
          currencyCode: item.package.currencyCode,
        }
      : null;

    return {
      id: item.id,
      title: item.title,
      // BOOKING items stay disabled in the planner until the booking engine
      // ships (D12); no API path can create one today.
      itemType: item.itemType as ItineraryItemType,
      startTime: item.startTime ? item.startTime.toISOString() : null,
      endTime: item.endTime ? item.endTime.toISOString() : null,
      notes: item.notes,
      sortOrder: item.sortOrder,
      destination,
      attraction,
      tour,
      experience,
      package: pkg,
      estimatedCostMinor: item.estimatedCostMinor,
      currencyCode: item.currencyCode,
      pricingBasis: item.pricingBasis as PricingBasis | null,
      estimateSource: item.estimateSource as EstimateSource | null,
      priceSnapshotAt: item.priceSnapshotAt ? item.priceSnapshotAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private toDetail(trip: TripGraph): TripDetail {
    const startDate = trip.startDate ? formatDateOnly(trip.startDate) : null;
    const endDate = trip.endDate ? formatDateOnly(trip.endDate) : null;

    const days = trip.days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: day.date ? formatDateOnly(day.date) : null,
      title: day.title,
      notes: day.notes,
      items: day.items.map((item) => this.toItem(item)),
    }));
    const unscheduledItems = trip.items.map((item) => this.toItem(item));

    const summary = computeTripSummary({
      days: trip.days.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        date: day.date ? formatDateOnly(day.date) : null,
        items: day.items.map(toSummaryItem),
      })),
      unscheduledItems: trip.items.map(toSummaryItem),
      adults: trip.adults,
      children: trip.children,
      currencyCode: trip.currencyCode,
      budgetMinor: trip.budgetMinor,
      budgetType: trip.budgetType,
      travelPace: trip.travelPace,
      startDate,
      endDate,
    });

    return {
      id: trip.id,
      name: trip.name,
      startDate,
      endDate,
      status: trip.status,
      adults: trip.adults,
      children: trip.children,
      budgetMinor: trip.budgetMinor,
      currencyCode: trip.currencyCode,
      notes: trip.notes,
      interests: trip.interests,
      travelPace: trip.travelPace,
      budgetTier: trip.budgetTier,
      budgetType: trip.budgetType,
      budgetIncludesFlights: trip.budgetIncludesFlights,
      arrivalPoint: trip.arrivalPoint,
      destinationPreferences: trip.destinationPreferences,
      travelers: trip.travelers.map((traveler) => ({
        id: traveler.id,
        name: traveler.name,
        ageGroup: traveler.ageGroup,
        // Owner-private fields (consent/visibility) are intentionally not part
        // of the DTO — they are not shared with any client surface yet.
        needs: traveler.needs.map((need) => ({
          id: need.id,
          category: need.category,
          details: need.details,
        })),
      })),
      days,
      unscheduledItems,
      summary,
      createdAt: trip.createdAt.toISOString(),
      updatedAt: trip.updatedAt.toISOString(),
    };
  }
}
