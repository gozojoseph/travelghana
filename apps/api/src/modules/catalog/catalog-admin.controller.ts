import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Role } from "@travelghana/database";
import {
  attractionAdminCreateSchema,
  attractionAdminQuerySchema,
  attractionAdminUpdateSchema,
  catalogIdParamSchema,
  destinationAdminCreateSchema,
  destinationAdminQuerySchema,
  destinationAdminUpdateSchema,
  type AttractionAdminCreateInput,
  type AttractionAdminQuery,
  type AttractionAdminUpdateInput,
  type CatalogIdParam,
  type DestinationAdminCreateInput,
  type DestinationAdminQuery,
  type DestinationAdminUpdateInput,
} from "@travelghana/validation";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AnyRole } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { CatalogAdminService } from "./catalog-admin.service";

/**
 * /api/admin/catalog — destinations + attractions CRUD (D20 Phase 6).
 * City/region management stays read-only in this increment: forms use the
 * cities selector, and neither entity has an admin CRUD surface yet.
 */
@Controller("admin/catalog")
export class CatalogAdminController {
  constructor(private readonly catalog: CatalogAdminService) {}

  // ── Read-only selector ──────────────────────────────────────────────

  @Get("cities")
  @AnyRole(Role.ADMIN)
  async cities() {
    return this.catalog.listCities();
  }

  // ── Destinations ────────────────────────────────────────────────────

  @Get("destinations")
  @AnyRole(Role.ADMIN)
  async listDestinations(
    @Query(new ZodValidationPipe(destinationAdminQuerySchema))
    query: DestinationAdminQuery,
  ) {
    return this.catalog.listDestinations(query);
  }

  @Post("destinations")
  @AnyRole(Role.ADMIN)
  async createDestination(
    @CurrentUser() admin: { id: string },
    @Body(new ZodValidationPipe(destinationAdminCreateSchema))
    body: DestinationAdminCreateInput,
  ) {
    return this.catalog.createDestination(admin.id, body);
  }

  @Get("destinations/:id")
  @AnyRole(Role.ADMIN)
  async getDestination(
    @Param(new ZodValidationPipe(catalogIdParamSchema)) params: CatalogIdParam,
  ) {
    return this.catalog.getDestination(params.id);
  }

  @Patch("destinations/:id")
  @AnyRole(Role.ADMIN)
  async updateDestination(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(catalogIdParamSchema)) params: CatalogIdParam,
    @Body(new ZodValidationPipe(destinationAdminUpdateSchema))
    body: DestinationAdminUpdateInput,
  ) {
    return this.catalog.updateDestination(admin.id, params.id, body);
  }

  @Delete("destinations/:id")
  @AnyRole(Role.ADMIN)
  async deleteDestination(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(catalogIdParamSchema)) params: CatalogIdParam,
  ) {
    return this.catalog.deleteDestination(admin.id, params.id);
  }

  // ── Attractions ─────────────────────────────────────────────────────

  @Get("attractions")
  @AnyRole(Role.ADMIN)
  async listAttractions(
    @Query(new ZodValidationPipe(attractionAdminQuerySchema))
    query: AttractionAdminQuery,
  ) {
    return this.catalog.listAttractions(query);
  }

  @Post("attractions")
  @AnyRole(Role.ADMIN)
  async createAttraction(
    @CurrentUser() admin: { id: string },
    @Body(new ZodValidationPipe(attractionAdminCreateSchema))
    body: AttractionAdminCreateInput,
  ) {
    return this.catalog.createAttraction(admin.id, body);
  }

  @Get("attractions/:id")
  @AnyRole(Role.ADMIN)
  async getAttraction(
    @Param(new ZodValidationPipe(catalogIdParamSchema)) params: CatalogIdParam,
  ) {
    return this.catalog.getAttraction(params.id);
  }

  @Patch("attractions/:id")
  @AnyRole(Role.ADMIN)
  async updateAttraction(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(catalogIdParamSchema)) params: CatalogIdParam,
    @Body(new ZodValidationPipe(attractionAdminUpdateSchema))
    body: AttractionAdminUpdateInput,
  ) {
    return this.catalog.updateAttraction(admin.id, params.id, body);
  }

  @Delete("attractions/:id")
  @AnyRole(Role.ADMIN)
  async deleteAttraction(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(catalogIdParamSchema)) params: CatalogIdParam,
  ) {
    return this.catalog.deleteAttraction(admin.id, params.id);
  }
}
