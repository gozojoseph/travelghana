import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type { AdminProvidersResult } from "@travelghana/types";
import {
  adminProviderPatchSchema,
  adminProvidersQuerySchema,
  idParamSchema,
  type AdminProviderPatchInput,
  type AdminProvidersQuery,
  type IdParam,
} from "@travelghana/validation";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AnyRole } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { AdminProvidersService } from "./admin-providers.service";

/** /api/admin/providers — the operator verification queue. */
@Controller("admin/providers")
export class AdminProvidersController {
  constructor(private readonly providers: AdminProvidersService) {}

  @Get()
  @AnyRole(Role.ADMIN)
  async list(
    @Query(new ZodValidationPipe(adminProvidersQuerySchema))
    query: AdminProvidersQuery,
  ): Promise<AdminProvidersResult> {
    return this.providers.list(query);
  }

  @Patch(":id")
  @AnyRole(Role.ADMIN)
  async setVerificationStatus(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(adminProviderPatchSchema))
    body: AdminProviderPatchInput,
  ): Promise<{ provider: Awaited<AdminProvidersResult>["items"][number] }> {
    return this.providers.setVerificationStatus(admin.id, params.id, body);
  }
}
