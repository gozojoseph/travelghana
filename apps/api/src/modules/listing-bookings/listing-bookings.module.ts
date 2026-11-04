import { Module } from "@nestjs/common";

import { ListingBookingsAdminController } from "./listing-bookings-admin.controller";
import { ListingBookingsController } from "./listing-bookings.controller";
import { ListingBookingsService } from "./listing-bookings.service";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [MailModule],
  controllers: [ListingBookingsController, ListingBookingsAdminController],
  providers: [ListingBookingsService],
})
export class ListingBookingsModule {}
