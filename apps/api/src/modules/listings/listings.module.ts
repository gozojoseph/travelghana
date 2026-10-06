import { Module } from "@nestjs/common";

import { ListingController } from "./listings.controller";
import { ListingService } from "./listings.service";

/** Reusable Listing model: provider dashboard + admin review queue (admin-verified publish). */
@Module({
  controllers: [ListingController],
  providers: [ListingService],
  exports: [ListingService],
})
export class ListingModule {}
