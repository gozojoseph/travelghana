import { Body, Controller, Get, Post } from "@nestjs/common";
import type { ListingRequest, MyListingRequestsResult } from "@travelghana/types";
import {
  listingRequestCreateSchema,
  type ListingRequestCreateInput,
} from "@travelghana/validation";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { ListingBookingsService } from "./listing-bookings.service";

/**
 * Transport listing requests (D43). No @Public() - the global session guard
 * requires a signed-in user, so "request a quote" only works after login (the
 * web panel sends unauthenticated visitors to /login with a next= back first).
 */
@Controller("listing-requests")
export class ListingBookingsController {
  constructor(private readonly requests: ListingBookingsService) {}

  @Post()
  async create(
    @CurrentUser() actor: { id: string },
    @Body(new ZodValidationPipe(listingRequestCreateSchema)) input: ListingRequestCreateInput,
  ): Promise<{ request: ListingRequest }> {
    return { request: await this.requests.create(actor.id, input) };
  }

  /** The signed-in traveler's own transport requests (D43). */
  @Get("me")
  async mine(@CurrentUser() actor: { id: string }): Promise<MyListingRequestsResult> {
    return this.requests.listMine(actor.id);
  }
}
