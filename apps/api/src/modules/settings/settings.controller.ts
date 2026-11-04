import { Controller, Get } from "@nestjs/common";
import type { SiteSettings } from "@travelghana/types";

import { Public } from "../../common/decorators/public.decorator";
import { SettingsService } from "./settings.service";

/**
 * Public site settings (D24) - contact + social info for the footer and the
 * about page. The web app renders only the fields that are filled in, so an
 * unset field is never exposed as an empty link.
 */
@Controller("site-settings")
export class SettingsPublicController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get()
  async get(): Promise<{ settings: SiteSettings }> {
    return { settings: await this.settings.get() };
  }
}
