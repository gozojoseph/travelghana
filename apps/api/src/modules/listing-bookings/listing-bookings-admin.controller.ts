import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type { AdminListingRequest } from "@travelghana/types";
import {
  idParamSchema,
  listingRequestDecisionSchema,
  listingRequestListQuerySchema,
  listingRequestQuoteSchema,
  type IdParam,
  type ListingRequestDecisionInput,
  type ListingRequestListQuery,
  type ListingRequestQuoteInput,
} from "@travelghana/validation";

import { AnyRole } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { ListingBookingsService } from "./listing-bookings.service";

/**
 * /api/admin/listing-requests (D43) - the console queue for quote-based
 * transport requests. Three owner moves: send the written quote (emailed and
 * kept on the row), confirm / cancel a pending request, delete junk. Every
 * action is audited and emails the traveler; no payment state exists here.
 */
@Controller("admin/listing-requests")
export class ListingBookingsAdminController {
  constructor(private readonly requests: ListingBookingsService) {}

  @AnyRole(Role.ADMIN)
  @Get()
  async list(
    @Query(new ZodValidationPipe(listingRequestListQuerySchema)) query: ListingRequestListQuery,
  ): Promise<unknown> {
    return this.requests.listAdmin(query);
  }

  @AnyRole(Role.ADMIN)
  @Post(":id/quote")
  async quote(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(listingRequestQuoteSchema)) body: ListingRequestQuoteInput,
  ): Promise<{ message: string }> {
    return this.requests.quote(admin.id, params.id, body);
  }

  @AnyRole(Role.ADMIN)
  @Post(":id/decision")
  async decide(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(listingRequestDecisionSchema)) body: ListingRequestDecisionInput,
  ): Promise<{ request: AdminListingRequest }> {
    const request = await this.requests.decide(admin.id, params.id, body);
    return { request };
  }

  @AnyRole(Role.ADMIN)
  @Delete(":id")
  async remove(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<{ message: string }> {
    return this.requests.remove(admin.id, params.id);
  }
}
