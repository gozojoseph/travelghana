import { Controller, Delete, Get, Param, Query } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type { AdminNotificationsResult } from "@travelghana/types";
import {
  adminNotificationsQuerySchema,
  idParamSchema,
  type AdminNotificationsQuery,
  type IdParam,
} from "@travelghana/validation";

import { AnyRole } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { AdminNotificationsService } from "./admin-notifications.service";

/**
 * /api/admin/notifications - the delivery outbox. Visibility plus an audited
 * cleanup delete for QUEUED/FAILED records (D28); SENT records are history.
 */
@Controller("admin/notifications")
export class AdminNotificationsController {
  constructor(private readonly notifications: AdminNotificationsService) {}

  @Get()
  @AnyRole(Role.ADMIN)
  async list(
    @Query(new ZodValidationPipe(adminNotificationsQuerySchema))
    query: AdminNotificationsQuery,
  ): Promise<AdminNotificationsResult> {
    return this.notifications.list(query);
  }

  @Delete(":id")
  @AnyRole(Role.ADMIN)
  async remove(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<{ message: string }> {
    return this.notifications.remove(admin.id, params.id);
  }
}
