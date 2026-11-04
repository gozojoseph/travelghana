import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type { ListingStatusString, ListingSummaryDto } from "./listings.service";
import {
  idParamSchema,
  listingCreateSchema,
  listingUpdateSchema,
  reviewActionSchema,
  statusTransitionSchema,
  listingStatusQuerySchema,
  type ListingStatusInput,
} from "@travelghana/validation";
import { z } from "zod";

import { ApiError } from "../../common/errors/api-error";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AnyRole } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ListingService } from "./listings.service";

/**
 * Routes for the provider dashboard (listings + status workflow) and the admin
 * review queue.
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
@Controller("listings")
export class ListingController {
  constructor(private readonly service: ListingService) {}

  // ─── Operator dashboard ────────────────────────────────────────────────────

  @Get("me")
  async myListings(
    @CurrentUser() user?: { id: string },
    @Query(new ZodValidationPipe(listingStatusQuerySchema)) query?: z.infer<typeof listingStatusQuerySchema>,
  ): Promise<{ items: ListingSummaryDto[] }> {
    if (!user) throw ApiError.unauthorized();
    const status = query?.id;
    return {
      items: status ? await this.service.listMyListingsByStatus(user.id, status as ListingStatusInput) : await this.service.listMyListings(user.id),
    };
  }

  @Get("me/:id")
  async myListing(
    @CurrentUser() user: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: z.infer<typeof idParamSchema>,
  ): Promise<{ listing: ListingSummaryDto }> {
    if (!user) throw ApiError.unauthorized();
    const listing = await this.service.getMyListing(user.id, params.id);
    return { listing };
  }

  @Post("me")
  async createListing(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(listingCreateSchema)) body: z.infer<typeof listingCreateSchema>,
  ): Promise<{ listing: ListingSummaryDto }> {
    if (!user) throw ApiError.unauthorized();
    return { listing: await this.service.createListing(user.id, body) };
  }

  @Patch("me/:id")
  async updateListing(
    @CurrentUser() user: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: z.infer<typeof idParamSchema>,
    @Body(new ZodValidationPipe(listingUpdateSchema)) body: z.infer<typeof listingUpdateSchema>,
  ): Promise<{ listing: ListingSummaryDto }> {
    if (!user) throw ApiError.unauthorized();
    return { listing: await this.service.updateListing(user.id, params.id, body) };
  }

  @Delete("me/:id")
  async deleteListing(
    @CurrentUser() user: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: z.infer<typeof idParamSchema>,
  ): Promise<{ message: string }> {
    if (!user) throw ApiError.unauthorized();
    await this.service.deleteListing(user.id, params.id);
    return { message: "Listing deleted" };
  }

  @Patch("me/:id/status")
  async transitionStatus(
    @CurrentUser() user: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: z.infer<typeof idParamSchema>,
    @Body(new ZodValidationPipe(statusTransitionSchema)) body: z.infer<typeof statusTransitionSchema>,
  ): Promise<{ listing: ListingSummaryDto }> {
    if (!user) throw ApiError.unauthorized();
    if (!body || body.status === undefined) throw ApiError.badRequest("Missing status");
    return { listing: await this.service.transitionStatus(user.id, params.id, body.status as ListingStatusString) };
  }

  // ─── Admin review queue ────────────────────────────────────────────────────

  @AnyRole(Role.ADMIN)
  @Get("admin")
  async adminList(
    @Query(new ZodValidationPipe(listingStatusQuerySchema)) query?: z.infer<typeof listingStatusQuerySchema>,
  ): Promise<{ items: ListingSummaryDto[] }> {
    const status = query?.id;
    return {
      items: status
        ? await this.service.listAdminListings(status as ListingStatusInput | "ALL")
        : await this.service.listAdminListings("ALL"),
    };
  }

  @AnyRole(Role.ADMIN)
  @Patch("admin/:id/review")
  async review(
    @CurrentUser() user: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: z.infer<typeof idParamSchema>,
    @Body(new ZodValidationPipe(reviewActionSchema)) body: z.infer<typeof reviewActionSchema>,
  ): Promise<{ listing: ListingSummaryDto }> {
    if (!user) throw ApiError.unauthorized();
    if (!body || body.reviewStatus === undefined) throw ApiError.badRequest("Missing review action");
    return { listing: await this.service.reviewListing(params.id, body, user.id) };
  }
}
