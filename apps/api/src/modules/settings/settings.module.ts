import { Module } from "@nestjs/common";

import { SettingsAdminController } from "./settings-admin.controller";
import { SettingsPublicController } from "./settings.controller";
import { SettingsService } from "./settings.service";

/** Site settings (D24) - public contact + social info edited in the console. */
@Module({
  controllers: [SettingsPublicController, SettingsAdminController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
