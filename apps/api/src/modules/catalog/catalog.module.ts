import { Module } from "@nestjs/common";

import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";

/** Public catalog: browse published operator listings (tours + experiences). */
@Module({
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
