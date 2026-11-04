import { Module } from "@nestjs/common";

import { CatalogAdminController } from "./catalog-admin.controller";
import { CatalogAdminService } from "./catalog-admin.service";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";

/** Public catalog: browse published operator listings (tours + experiences). */
@Module({
  controllers: [CatalogController, CatalogAdminController],
  providers: [CatalogService, CatalogAdminService],
})
export class CatalogModule {}
