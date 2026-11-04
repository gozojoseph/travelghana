import { Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import type { SessionUser } from "@travelghana/types";
import { travelerNotificationsQuerySchema } from "@travelghana/validation";
import { z } from "zod";

import { ApiError } from "../../common/errors/api-error";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { NotificationsService } from "./notifications.service";

/**
 * Member-facing inbox (D40) under /api/notifications. Every route is
 * owner-scoped: rows are only ever read or mutated with the caller's own
 * userId - there is no cross-user lookup by design.
 */
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user?: SessionUser,
    @Query(new ZodValidationPipe(travelerNotificationsQuerySchema))
    query?: z.infer<typeof travelerNotificationsQuerySchema>,
  ) {
    if (!user) throw ApiError.unauthorized();
    if (!query) throw ApiError.badRequest("Missing query");
    return this.notificationsService.list(user.id, query);
  }

  @Get("unread")
  async unread(@CurrentUser() user?: SessionUser) {
    if (!user) throw ApiError.unauthorized();
    return this.notificationsService.unread(user.id);
  }

  @Patch(":id/read")
  async markRead(
    @Param("id") id: string,
    @CurrentUser() user?: SessionUser,
  ) {
    if (!user) throw ApiError.unauthorized();
    if (!id) throw ApiError.badRequest("Missing notification id");
    return this.notificationsService.markRead(user.id, id);
  }

  @Post("read-all")
  async markAllRead(@CurrentUser() user?: SessionUser) {
    if (!user) throw ApiError.unauthorized();
    return this.notificationsService.markAllRead(user.id);
  }
}
