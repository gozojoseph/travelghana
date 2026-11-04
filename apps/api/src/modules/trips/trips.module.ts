import { Module } from "@nestjs/common";

import { MailModule } from "../mail/mail.module";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";

/** Trip + itinerary planner (ARCHITECTURE.md step 5, D12). */
@Module({
  imports: [MailModule],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
