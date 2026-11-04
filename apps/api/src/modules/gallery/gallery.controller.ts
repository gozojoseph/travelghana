import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type { GalleryItem } from "@travelghana/types";
import {
  galleryItemCreateSchema,
  galleryItemListQuerySchema,
  galleryItemUpdateSchema,
  idParamSchema,
  type GalleryItemCreateInput,
  type GalleryItemListQuery,
  type GalleryItemUpdateInput,
  type IdParam,
} from "@travelghana/validation";

import { AnyRole } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { GalleryService } from "./gallery.service";

/**
 * Admin-only gallery CRUD.
 *
 * Every handler is guarded by an active ADMIN membership; the client-side
 * admin gate is only a UX affordance, this is the enforcement point.
 */
@Controller("admin/gallery")
export class AdminGalleryController {
  constructor(private readonly gallery: GalleryService) {}

  @Get()
  @AnyRole(Role.ADMIN)
  async list(
    @Query(new ZodValidationPipe(galleryItemListQuerySchema)) query: GalleryItemListQuery,
  ): Promise<{ items: GalleryItem[] }> {
    return { items: await this.gallery.list(query) };
  }

  @Post()
  @AnyRole(Role.ADMIN)
  async create(
    @Body(new ZodValidationPipe(galleryItemCreateSchema)) body: GalleryItemCreateInput,
  ): Promise<{ item: GalleryItem }> {
    return { item: await this.gallery.create(body) };
  }

  @Get(":id")
  @AnyRole(Role.ADMIN)
  async get(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<{ item: GalleryItem }> {
    return { item: await this.gallery.get(params.id) };
  }

  @Patch(":id")
  @AnyRole(Role.ADMIN)
  async update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(galleryItemUpdateSchema)) body: GalleryItemUpdateInput,
  ): Promise<{ item: GalleryItem }> {
    return { item: await this.gallery.update(params.id, body) };
  }

  @Delete(":id")
  @AnyRole(Role.ADMIN)
  async remove(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<{ message: string }> {
    await this.gallery.delete(params.id);
    return { message: "Gallery item deleted" };
  }
}
