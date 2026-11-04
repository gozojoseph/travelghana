import { Module } from "@nestjs/common";

import { AdminGalleryController } from "./gallery.controller";
import { GalleryPublicController } from "./gallery.public.controller";
import { GalleryService } from "./gallery.service";

/** Gallery — admin-managed platform content with a published-only public page. */
@Module({
  controllers: [GalleryPublicController, AdminGalleryController],
  providers: [GalleryService],
  exports: [GalleryService],
})
export class GalleryModule {}
