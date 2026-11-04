import { Module } from "@nestjs/common";

import { AdminPackagesController } from "./packages.controller";
import { PackagesPublicController } from "./packages.public.controller";
import { PackagesService } from "./packages.service";

/** Curated packages — admin-managed platform content with a published-only public catalog. */
@Module({
  controllers: [PackagesPublicController, AdminPackagesController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}
