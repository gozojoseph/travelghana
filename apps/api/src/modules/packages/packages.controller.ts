import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type {
  PackageDepartureDto,
  PackageDetail,
  PackageSummary,
} from "@travelghana/types";
import {
  departureBulkCreateSchema,
  departureCreateSchema,
  departureParamsSchema,
  departureUpdateSchema,
  idParamSchema,
  packageCreateSchema,
  packageListQuerySchema,
  packageUpdateSchema,
  type DepartureBulkCreateInput,
  type DepartureCreateInput,
  type DepartureParams,
  type DepartureUpdateInput,
  type IdParam,
  type PackageCreateInput,
  type PackageListQuery,
  type PackageUpdateInput,
} from "@travelghana/validation";

import { AnyRole } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { PackagesService } from "./packages.service";

/**
 * Admin-only curated package CRUD.
 *
 * Every handler is guarded by an active ADMIN membership; the client-side
 * admin gate is only a UX affordance, this is the enforcement point.
 */
@Controller("admin/packages")
export class AdminPackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get()
  @AnyRole(Role.ADMIN)
  async list(
    @Query(new ZodValidationPipe(packageListQuerySchema)) query: PackageListQuery,
  ): Promise<{ items: PackageSummary[] }> {
    return { items: await this.packages.list(query) };
  }

  @Post()
  @AnyRole(Role.ADMIN)
  async create(
    @Body(new ZodValidationPipe(packageCreateSchema)) body: PackageCreateInput,
  ): Promise<{ package: PackageDetail }> {
    return { package: await this.packages.create(body) };
  }

  @Get(":id")
  @AnyRole(Role.ADMIN)
  async get(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<{ package: PackageDetail }> {
    return { package: await this.packages.get(params.id) };
  }

  @Patch(":id")
  @AnyRole(Role.ADMIN)
  async update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(packageUpdateSchema)) body: PackageUpdateInput,
  ): Promise<{ package: PackageDetail }> {
    return { package: await this.packages.update(params.id, body) };
  }

  @Delete(":id")
  @AnyRole(Role.ADMIN)
  async remove(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<{ message: string }> {
    await this.packages.delete(params.id);
    return { message: "Package deleted" };
  }

  // ─── Departures (D41) ──────────────────────────────────────────────────────

  @Get(":id/departures")
  @AnyRole(Role.ADMIN)
  async listDepartures(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<{ departures: PackageDepartureDto[] }> {
    return { departures: await this.packages.listAdminDepartures(params.id) };
  }

  @Post(":id/departures")
  @AnyRole(Role.ADMIN)
  async createDeparture(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(departureCreateSchema)) body: DepartureCreateInput,
  ): Promise<{ departures: PackageDepartureDto[] }> {
    return this.packages.createDeparture(params.id, body);
  }

  @Post(":id/departures/weekly")
  @AnyRole(Role.ADMIN)
  async createDeparturesWeekly(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(departureBulkCreateSchema)) body: DepartureBulkCreateInput,
  ): Promise<{ created: number; departures: PackageDepartureDto[] }> {
    return this.packages.createDeparturesWeekly(params.id, body);
  }

  @Patch(":id/departures/:departureId")
  @AnyRole(Role.ADMIN)
  async updateDeparture(
    @Param(new ZodValidationPipe(departureParamsSchema)) params: DepartureParams,
    @Body(new ZodValidationPipe(departureUpdateSchema)) body: DepartureUpdateInput,
  ): Promise<{ departure: PackageDepartureDto }> {
    return this.packages.updateDeparture(params.id, params.departureId, body);
  }

  @Delete(":id/departures/:departureId")
  @AnyRole(Role.ADMIN)
  async removeDeparture(
    @Param(new ZodValidationPipe(departureParamsSchema)) params: DepartureParams,
  ): Promise<{ message: string }> {
    await this.packages.deleteDeparture(params.id, params.departureId);
    return { message: "Departure deleted" };
  }
}
