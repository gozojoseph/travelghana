import { Module } from "@nestjs/common";

import { MailModule } from "../mail/mail.module";
import { BookingsAdminController } from "./bookings-admin.controller";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";

/** Package bookings (D25/D26) - traveler requests for curated packages. */
@Module({
  imports: [MailModule],
  controllers: [BookingsController, BookingsAdminController],
  providers: [BookingsService],
})
export class BookingsModule {}
