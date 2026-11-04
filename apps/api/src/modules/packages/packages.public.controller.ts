import { Controller, Get, Param } from "@nestjs/common";
import type {
  PackageDepartureDto,
  PackageDetail,
  PackageSummary,
} from "@travelghana/types";
import {
  packageSlugParamSchema,
  type PackageSlugParam,
} from "@travelghana/validation";

import { Public } from "../../common/decorators/public.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { PackagesService } from "./packages.service";

/**
 * Read-only public package catalog.
 *
 * Only PUBLISHED packages are exposed; the admin controller keeps drafts and
 * archived content private. Packages are not bookable yet.
 */
@Controller("packages")
export class PackagesPublicController {
  constructor(private readonly packages: PackagesService) {}

  @Public()
  @Get()
  async list(): Promise<{ items: PackageSummary[] }> {
    return { items: await this.packages.listPublished() };
  }

  @Public()
  @Get(":slug")
  async get(
    @Param(new ZodValidationPipe(packageSlugParamSchema)) params: PackageSlugParam,
  ): Promise<{ package: PackageDetail }> {
    return { package: await this.packages.getPublishedBySlug(params.slug) };
  }

  /** Future departure dates with seats left (D41) - the booking form's list. */
  @Public()
  @Get(":slug/departures")
  async listDepartures(
    @Param(new ZodValidationPipe(packageSlugParamSchema)) params: PackageSlugParam,
  ): Promise<{ departures: PackageDepartureDto[] }> {
    return { departures: await this.packages.listPublicDepartures(params.slug) };
  }
}
