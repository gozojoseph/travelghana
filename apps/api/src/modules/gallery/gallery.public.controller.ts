import { Controller, Get } from "@nestjs/common";
import type { GalleryItem } from "@travelghana/types";

import { Public } from "../../common/decorators/public.decorator";
import { GalleryService } from "./gallery.service";

/**
 * Read-only public gallery.
 *
 * Only published items are exposed, in the curated order. There is no public
 * detail route — the gallery is a single visual surface.
 */
@Controller("gallery")
export class GalleryPublicController {
  constructor(private readonly gallery: GalleryService) {}

  @Public()
  @Get()
  async list(): Promise<{ items: GalleryItem[] }> {
    return { items: await this.gallery.listPublished() };
  }
}
