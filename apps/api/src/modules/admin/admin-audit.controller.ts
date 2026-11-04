import { Controller, Get, Query } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type { AdminAuditResult } from "@travelghana/types";
import { adminAuditQuerySchema, type AdminAuditQuery } from "@travelghana/validation";

import { AnyRole } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { AdminAuditService } from "./admin-audit.service";

/** /api/admin/audit — read-only activity trail. */
@Controller("admin/audit")
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get()
  @AnyRole(Role.ADMIN)
  async list(
    @Query(new ZodValidationPipe(adminAuditQuerySchema)) query: AdminAuditQuery,
  ): Promise<AdminAuditResult> {
    return this.audit.list(query);
  }
}
