import { Module } from "@nestjs/common";

import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

/** Traveler inbox over the shared Notification outbox (D40). */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
