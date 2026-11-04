import { Body, Controller, Patch } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type { SiteSettings } from "@travelghana/types";
import { siteSettingsUpdateSchema, type SiteSettingsUpdateInput } from "@travelghana/validation";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AnyRole } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { SettingsService } from "./settings.service";

/**
 * /api/admin/settings (D24) - the single site-settings form, saved from the
 * console at any time. The PATCH is a full replace (see the schema) and every
 * save is audited like any other admin mutation.
 */
@Controller("admin/settings")
export class SettingsAdminController {
  constructor(private readonly settings: SettingsService) {}

  @AnyRole(Role.ADMIN)
  @Patch()
  async update(
    @CurrentUser() admin: { id: string },
    @Body(new ZodValidationPipe(siteSettingsUpdateSchema)) input: SiteSettingsUpdateInput,
  ): Promise<{ settings: SiteSettings }> {
    return { settings: await this.settings.update(admin.id, input) };
  }
}
