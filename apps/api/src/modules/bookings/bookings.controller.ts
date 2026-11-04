import { Body, Controller, Get, Post } from "@nestjs/common";
import type { MyPackageBookingsResult, PackageBooking } from "@travelghana/types";
import { packageBookingCreateSchema, type PackageBookingCreateInput } from "@travelghana/validation";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { BookingsService } from "./bookings.service";

/**
 * Package bookings (D25). No @Public() - the global session guard requires a
 * signed-in user, so "book now" only works after login (the web panel sends
 * unauthenticated visitors to /login with a next= back to this page first).
 */
@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  async create(
    @CurrentUser() actor: { id: string },
    @Body(new ZodValidationPipe(packageBookingCreateSchema)) input: PackageBookingCreateInput,
  ): Promise<{ booking: PackageBooking }> {
    return { booking: await this.bookings.create(actor.id, input) };
  }

  /** The signed-in traveler's own booking requests (D26). */
  @Get("me")
  async mine(@CurrentUser() actor: { id: string }): Promise<MyPackageBookingsResult> {
    return this.bookings.listMine(actor.id);
  }
}
