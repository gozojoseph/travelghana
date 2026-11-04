import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import type { PackageReviewStatus, PackageReviewsResult, ReviewEligibilityDto } from "@travelghana/types";
import {
  reviewCreateSchema,
  reviewEligibilityQuerySchema,
  reviewListQuerySchema,
  type ReviewCreateInput,
  type ReviewEligibilityQuery,
  type ReviewListQuery,
} from "@travelghana/validation";

import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { PackageReviewsService } from "./reviews.service";

/**
 * Package reviews (D42). The public list is approved-only; submitting a
 * review and asking for eligibility require a signed-in traveler - the
 * global session guard enforces that, the service enforces the
 * confirmed-booking gate itself.
 */
@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviews: PackageReviewsService) {}

  /** Approved reviews + star summary for one package (slug-addressed). */
  @Public()
  @Get()
  async list(@Query(new ZodValidationPipe(reviewListQuerySchema)) query: ReviewListQuery): Promise<PackageReviewsResult> {
    return this.reviews.listPublic(query);
  }

  /** Whether the signed-in traveler can review this package - and whether
   * they already have (any status, so the form can show their own queue). */
  @Get("status")
  async status(
    @CurrentUser() actor: { id: string },
    @Query(new ZodValidationPipe(reviewEligibilityQuerySchema)) query: ReviewEligibilityQuery,
  ): Promise<ReviewEligibilityDto> {
    return this.reviews.eligibility(actor.id, query);
  }

  /** Submit a review. Lands PENDING; moderation decides visibility. */
  @Post()
  async create(
    @CurrentUser() actor: { id: string },
    @Body(new ZodValidationPipe(reviewCreateSchema)) input: ReviewCreateInput,
  ): Promise<{ status: PackageReviewStatus }> {
    return this.reviews.createForUser(actor.id, input);
  }
}
