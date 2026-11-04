import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type { AdminPackageReviewDto, AdminPackageReviewsResult } from "@travelghana/types";
import {
  adminReviewDecisionSchema,
  adminReviewListQuerySchema,
  idParamSchema,
  type AdminReviewDecisionInput,
  type AdminReviewListQuery,
  type IdParam,
} from "@travelghana/validation";

import { AnyRole } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { PackageReviewsService } from "./reviews.service";

/**
 * /api/admin/reviews (D42) - the moderation queue for package reviews.
 * Approve publishes; reject keeps the reviewer's reason on the record and
 * never shows the text publicly. Decisions are admin-only and audited.
 */
@Controller("admin/reviews")
export class ReviewsAdminController {
  constructor(private readonly reviews: PackageReviewsService) {}

  @Get()
  @AnyRole(Role.ADMIN)
  async list(
    @Query(new ZodValidationPipe(adminReviewListQuerySchema)) query: AdminReviewListQuery,
  ): Promise<AdminPackageReviewsResult> {
    return this.reviews.listAdmin(query);
  }

  @Post(":id/approve")
  @AnyRole(Role.ADMIN)
  async approve(
    @CurrentUser() actor: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<{ review: AdminPackageReviewDto }> {
    return this.reviews.approve(actor.id, params.id);
  }

  @Post(":id/reject")
  @AnyRole(Role.ADMIN)
  async reject(
    @CurrentUser() actor: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(adminReviewDecisionSchema)) body: AdminReviewDecisionInput,
  ): Promise<{ review: AdminPackageReviewDto }> {
    return this.reviews.reject(actor.id, params.id, body.reason);
  }
}
