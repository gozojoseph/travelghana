import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import type { TripDetail, TripShareStatus, TripShareView, TripSummary } from "@travelghana/types";
import {
  itineraryDayCreateSchema,
  itineraryDayUpdateSchema,
  itineraryItemCreateSchema,
  itineraryItemMoveSchema,
  itineraryItemUpdateSchema,
  reorderItemsSchema,
  travelerCreateSchema,
  travelerUpdateSchema,
  tripCreateSchema,
  tripDayParamsSchema,
  tripItemParamsSchema,
  tripParamsSchema,
  tripShareParamsSchema,
  tripTravelerParamsSchema,
  tripUpdateSchema,
  type ItineraryDayCreateInput,
  type ItineraryDayUpdateInput,
  type ItineraryItemCreateInput,
  type ItineraryItemMoveInput,
  type ItineraryItemUpdateInput,
  type ReorderItemsInput,
  type TravelerCreateInput,
  type TravelerUpdateInput,
  type TripCreateInput,
  type TripDayParams,
  type TripItemParams,
  type TripParams,
  type TripShareParams,
  type TripTravelerParams,
  type TripUpdateInput,
} from "@travelghana/validation";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ApiError } from "../../common/errors/api-error";
import { Public } from "../../common/decorators/public.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { TripsService } from "./trips.service";

/**
 * Trip planner routes (ARCHITECTURE.md step 5, D12).
 *
 * Every route is owner-scoped by the session user; no role gate is needed
 * (every traveler has trips). Nested mutations return the full updated trip so
 * the web client can re-render from one response.
 */
@Controller("trips")
export class TripsController {
  constructor(private readonly service: TripsService) {}

  @Get()
  async list(@CurrentUser() user?: { id: string }): Promise<{ items: TripSummary[] }> {
    if (!user) throw ApiError.unauthorized();
    return { items: await this.service.listTrips(user.id) };
  }

  /**
   * Public sanitized share view (D19). Declared before the owner routes only
   * for readability — Express distinguishes the two-segment path from
   * `GET /trips/:id` anyway.
   */
  @Public()
  @Get("share/:token")
  async shared(
    @Param(new ZodValidationPipe(tripShareParamsSchema)) params: TripShareParams,
  ): Promise<{ share: TripShareView }> {
    return { share: await this.service.getSharedByToken(params.token) };
  }

  @Post()
  async create(
    @CurrentUser() user: { id: string } | undefined,
    @Body(new ZodValidationPipe(tripCreateSchema)) body: TripCreateInput,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return { trip: await this.service.createTrip(user.id, body) };
  }

  @Get(":id")
  async get(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripParamsSchema)) params: TripParams,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return { trip: await this.service.getTrip(user.id, params.id) };
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripParamsSchema)) params: TripParams,
    @Body(new ZodValidationPipe(tripUpdateSchema)) body: TripUpdateInput,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return { trip: await this.service.updateTrip(user.id, params.id, body) };
  }

  @Delete(":id")
  async remove(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripParamsSchema)) params: TripParams,
  ): Promise<{ message: string }> {
    if (!user) throw ApiError.unauthorized();
    await this.service.deleteTrip(user.id, params.id);
    return { message: "Trip deleted" };
  }

  // ─── Sharing (D19: sanitized companion view) ────────────────────────────────

  @Get(":id/share")
  async shareStatus(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripParamsSchema)) params: TripParams,
  ): Promise<{ share: TripShareStatus }> {
    if (!user) throw ApiError.unauthorized();
    return { share: await this.service.shareStatus(user.id, params.id) };
  }

  /** Create (or rotate) the share link; the previous link stops working. */
  @Post(":id/share")
  async createShare(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripParamsSchema)) params: TripParams,
  ): Promise<{ share: TripShareStatus }> {
    if (!user) throw ApiError.unauthorized();
    return { share: await this.service.createShare(user.id, params.id) };
  }

  @Delete(":id/share")
  async revokeShare(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripParamsSchema)) params: TripParams,
  ): Promise<{ share: TripShareStatus }> {
    if (!user) throw ApiError.unauthorized();
    return { share: await this.service.revokeShare(user.id, params.id) };
  }

  // ─── Travelers + needs ──────────────────────────────────────────────────────

  @Post(":id/travelers")
  async addTraveler(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripParamsSchema)) params: TripParams,
    @Body(new ZodValidationPipe(travelerCreateSchema)) body: TravelerCreateInput,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return { trip: await this.service.addTraveler(user.id, params.id, body) };
  }

  @Patch(":id/travelers/:travelerId")
  async updateTraveler(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripTravelerParamsSchema)) params: TripTravelerParams,
    @Body(new ZodValidationPipe(travelerUpdateSchema)) body: TravelerUpdateInput,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return {
      trip: await this.service.updateTraveler(
        user.id,
        params.id,
        params.travelerId,
        body,
      ),
    };
  }

  @Delete(":id/travelers/:travelerId")
  async removeTraveler(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripTravelerParamsSchema)) params: TripTravelerParams,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return {
      trip: await this.service.removeTraveler(
        user.id,
        params.id,
        params.travelerId,
      ),
    };
  }

  // ─── Itinerary days ─────────────────────────────────────────────────────────

  @Post(":id/days")
  async addDay(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripParamsSchema)) params: TripParams,
    @Body(new ZodValidationPipe(itineraryDayCreateSchema)) body: ItineraryDayCreateInput,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return { trip: await this.service.addDay(user.id, params.id, body) };
  }

  @Patch(":id/days/:dayId")
  async updateDay(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripDayParamsSchema)) params: TripDayParams,
    @Body(new ZodValidationPipe(itineraryDayUpdateSchema)) body: ItineraryDayUpdateInput,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return {
      trip: await this.service.updateDay(user.id, params.id, params.dayId, body),
    };
  }

  @Delete(":id/days/:dayId")
  async removeDay(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripDayParamsSchema)) params: TripDayParams,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return {
      trip: await this.service.removeDay(user.id, params.id, params.dayId),
    };
  }

  // ─── Itinerary items ────────────────────────────────────────────────────────

  /** Add an idea to the unscheduled tray (not tied to a day yet). */
  @Post(":id/items")
  async addUnscheduledItem(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripParamsSchema)) params: TripParams,
    @Body(new ZodValidationPipe(itineraryItemCreateSchema)) body: ItineraryItemCreateInput,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return {
      trip: await this.service.addUnscheduledItem(user.id, params.id, body),
    };
  }

  @Post(":id/items/reorder")
  async reorderUnscheduledItems(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripParamsSchema)) params: TripParams,
    @Body(new ZodValidationPipe(reorderItemsSchema)) body: ReorderItemsInput,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return {
      trip: await this.service.reorderUnscheduledItems(
        user.id,
        params.id,
        body.itemIds,
      ),
    };
  }

  @Post(":id/days/:dayId/items")
  async addItem(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripDayParamsSchema)) params: TripDayParams,
    @Body(new ZodValidationPipe(itineraryItemCreateSchema)) body: ItineraryItemCreateInput,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return {
      trip: await this.service.addItem(user.id, params.id, params.dayId, body),
    };
  }

  @Post(":id/days/:dayId/items/reorder")
  async reorderItems(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripDayParamsSchema)) params: TripDayParams,
    @Body(new ZodValidationPipe(reorderItemsSchema)) body: ReorderItemsInput,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return {
      trip: await this.service.reorderItems(
        user.id,
        params.id,
        params.dayId,
        body.itemIds,
      ),
    };
  }

  @Patch(":id/items/:itemId")
  async updateItem(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripItemParamsSchema)) params: TripItemParams,
    @Body(new ZodValidationPipe(itineraryItemUpdateSchema)) body: ItineraryItemUpdateInput,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return {
      trip: await this.service.updateItem(user.id, params.id, params.itemId, body),
    };
  }

  /** Move an item to another day, or to the unscheduled tray (`dayId: null`). */
  @Patch(":id/items/:itemId/move")
  async moveItem(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripItemParamsSchema)) params: TripItemParams,
    @Body(new ZodValidationPipe(itineraryItemMoveSchema)) body: ItineraryItemMoveInput,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return {
      trip: await this.service.moveItem(user.id, params.id, params.itemId, body),
    };
  }

  @Delete(":id/items/:itemId")
  async removeItem(
    @CurrentUser() user: { id: string } | undefined,
    @Param(new ZodValidationPipe(tripItemParamsSchema)) params: TripItemParams,
  ): Promise<{ trip: TripDetail }> {
    if (!user) throw ApiError.unauthorized();
    return {
      trip: await this.service.removeItem(user.id, params.id, params.itemId),
    };
  }
}
