import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type { AdminPackageBookingDto } from "@travelghana/types";
import {
  adminBookingAcknowledgeSchema,
  adminBookingConcernSchema,
  adminBookingDecisionSchema,
  idParamSchema,
  packageBookingListQuerySchema,
  type AdminBookingAcknowledgeInput,
  type AdminBookingConcernInput,
  type AdminBookingDecisionInput,
  type IdParam,
  type PackageBookingListQuery,
} from "@travelghana/validation";

import { AnyRole } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { BookingsService } from "./bookings.service";

/**
 * /api/admin/bookings (D25) - the console queue for package booking requests.
 * D36 adds the owner-facing outreach moves: acknowledge (we're looking after
 * it), concern (a written question/issue on the record), and the availability
 * decision for payment-pending requests (confirm / cancel with reason).
 * Every action is audited and emails the traveler; later status transitions
 * (completed/refunded) still follow the payment rails.
 */
@Controller("admin/bookings")
export class BookingsAdminController {
  constructor(private readonly bookings: BookingsService) {}

  @AnyRole(Role.ADMIN)
  @Get()
  async list(
    @Query(new ZodValidationPipe(packageBookingListQuerySchema)) query: PackageBookingListQuery,
  ): Promise<unknown> {
    return this.bookings.listAdmin(query);
  }

  @AnyRole(Role.ADMIN)
  @Post(":id/acknowledge")
  async acknowledge(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(adminBookingAcknowledgeSchema)) body: AdminBookingAcknowledgeInput,
  ): Promise<{ message: string }> {
    return this.bookings.acknowledge(admin.id, params.id, body.message);
  }

  @AnyRole(Role.ADMIN)
  @Post(":id/concern")
  async concern(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(adminBookingConcernSchema)) body: AdminBookingConcernInput,
  ): Promise<{ message: string }> {
    return this.bookings.concern(admin.id, params.id, body.message);
  }

  @AnyRole(Role.ADMIN)
  @Post(":id/decision")
  async decide(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(adminBookingDecisionSchema)) body: AdminBookingDecisionInput,
  ): Promise<{ booking: AdminPackageBookingDto }> {
    const booking = await this.bookings.decide(admin.id, params.id, body);
    return { booking };
  }

  /** Manual payments (D44): record payment received for a confirmed booking. */
  @AnyRole(Role.ADMIN)
  @Post(":id/paid")
  async markPaid(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<{ booking: AdminPackageBookingDto }> {
    return { booking: await this.bookings.markPaid(admin.id, params.id) };
  }

  @AnyRole(Role.ADMIN)
  @Delete(":id")
  async remove(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<{ message: string }> {
    return this.bookings.remove(admin.id, params.id);
  }
}
