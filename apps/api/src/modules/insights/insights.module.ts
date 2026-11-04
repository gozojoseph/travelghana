import { Module } from "@nestjs/common";

import { AdminInsightsController } from "./insights.controller";
import { InsightsService } from "./insights.service";
import { TrackController } from "./track.controller";

/**
 * First-party visitor insights (D37): the public /api/track collector plus
 * the admin-only aggregates. PrismaService comes from the global PrismaModule.
 */
@Module({
  controllers: [TrackController, AdminInsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
