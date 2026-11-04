import { Module } from "@nestjs/common";

import { ReviewsAdminController } from "./reviews-admin.controller";
import { ReviewsController } from "./reviews.controller";
import { PackageReviewsService } from "./reviews.service";

/**
 * Package reviews (D42): traveler submissions gated on a team-confirmed
 * booking, an admin moderation queue, and a public approved-only list.
 */
@Module({
  controllers: [ReviewsController, ReviewsAdminController],
  providers: [PackageReviewsService],
})
export class ReviewsModule {}
