import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type { AdminUsersResult, AdminUserUpdateResult } from "@travelghana/types";
import {
  adminUserUpdateSchema,
  adminUsersQuerySchema,
  idParamSchema,
  type AdminUserUpdateInput,
  type AdminUsersQuery,
  type IdParam,
} from "@travelghana/validation";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AnyRole } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { AdminUsersService } from "./admin-users.service";

/** /api/admin/users — role grants/revocations and account suspension. */
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @AnyRole(Role.ADMIN)
  async list(
    @Query(new ZodValidationPipe(adminUsersQuerySchema))
    query: AdminUsersQuery,
  ): Promise<AdminUsersResult> {
    return this.users.list(query);
  }

  @Patch(":id")
  @AnyRole(Role.ADMIN)
  async update(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(adminUserUpdateSchema))
    body: AdminUserUpdateInput,
  ): Promise<AdminUserUpdateResult> {
    return this.users.update(admin.id, params.id, body);
  }
}
