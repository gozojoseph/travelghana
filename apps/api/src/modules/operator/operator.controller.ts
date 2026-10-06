import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import type { Provider, Tour, Experience } from "@travelghana/database";
import type { SessionUser } from "@travelghana/types";
import {
  experienceCreateSchema,
  experienceUpdateSchema,
  idParamSchema,
  providerOnboardSchema,
  providerUpdateSchema,
  tourCreateSchema,
  tourUpdateSchema,
} from "@travelghana/validation";
import { z } from "zod";

import { ApiError } from "../../common/errors/api-error";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AnyRole } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Role } from "@travelghana/database";

import { OperatorService } from "./operator.service";

/**
 * Operator self-service under /api/operator (D5 operator-first).
 * Onboarding is open to any authenticated user; listing management requires an
 * operator role. All data is scoped to the caller's own provider.
 */
@Controller("operator")
export class OperatorController {
  constructor(private readonly operator: OperatorService) {}

  @Get("me/provider")
  async myProvider(@CurrentUser() user?: SessionUser): Promise<{ provider: Provider | null }> {
    this.assertUser(user);
    return { provider: await this.operator.getProvider(user.id) };
  }

  @Post("providers")
  async onboard(
    @CurrentUser() user?: SessionUser,
    @Body(new ZodValidationPipe(providerOnboardSchema)) body?: z.infer<typeof providerOnboardSchema>,
  ): Promise<{ provider: Provider }> {
    this.assertUser(user);
    this.assertBody(body);
    return { provider: await this.operator.onboard(user.id, body) };
  }

  @Patch("me/provider")
  async updateProvider(
    @CurrentUser() user?: SessionUser,
    @Body(new ZodValidationPipe(providerUpdateSchema)) body?: z.infer<typeof providerUpdateSchema>,
  ): Promise<{ provider: Provider }> {
    this.assertUser(user);
    this.assertBody(body);
    return { provider: await this.operator.updateProvider(user.id, body) };
  }

  // ─── Tours ──────────────────────────────────────────────────────────────────

  @AnyRole(Role.TOUR_OPERATOR, Role.HOTEL_MANAGER, Role.EXPERIENCE_PROVIDER, Role.TRANSPORT_COMPANY)
  @Get("me/tours")
  async tours(@CurrentUser() user?: SessionUser): Promise<{ items: Tour[] }> {
    this.assertUser(user);
    return { items: await this.operator.listTours(user.id) };
  }

  @AnyRole(Role.TOUR_OPERATOR, Role.HOTEL_MANAGER, Role.EXPERIENCE_PROVIDER, Role.TRANSPORT_COMPANY)
  @Post("me/tours")
  async createTour(
    @CurrentUser() user?: SessionUser,
    @Body(new ZodValidationPipe(tourCreateSchema)) body?: z.infer<typeof tourCreateSchema>,
  ): Promise<{ tour: Tour }> {
    this.assertUser(user);
    this.assertBody(body);
    return { tour: await this.operator.createTour(user.id, body) };
  }

  @AnyRole(Role.TOUR_OPERATOR, Role.HOTEL_MANAGER, Role.EXPERIENCE_PROVIDER, Role.TRANSPORT_COMPANY)
  @Patch("me/tours/:id")
  async updateTour(
    @CurrentUser() user?: SessionUser,
    @Param(new ZodValidationPipe(idParamSchema)) params?: z.infer<typeof idParamSchema>,
    @Body(new ZodValidationPipe(tourUpdateSchema)) body?: z.infer<typeof tourUpdateSchema>,
  ): Promise<{ tour: Tour }> {
    this.assertUser(user);
    this.assertParams(params);
    this.assertBody(body);
    return { tour: await this.operator.updateTour(user.id, params.id, body) };
  }

  @AnyRole(Role.TOUR_OPERATOR, Role.HOTEL_MANAGER, Role.EXPERIENCE_PROVIDER, Role.TRANSPORT_COMPANY)
  @Delete("me/tours/:id")
  async deleteTour(
    @CurrentUser() user?: SessionUser,
    @Param(new ZodValidationPipe(idParamSchema)) params?: z.infer<typeof idParamSchema>,
  ): Promise<{ message: string }> {
    this.assertUser(user);
    this.assertParams(params);
    await this.operator.deleteTour(user.id, params.id);
    return { message: "Tour deleted" };
  }

  // ─── Experiences ────────────────────────────────────────────────────────────

  @AnyRole(Role.TOUR_OPERATOR, Role.HOTEL_MANAGER, Role.EXPERIENCE_PROVIDER, Role.TRANSPORT_COMPANY)
  @Get("me/experiences")
  async experiences(@CurrentUser() user?: SessionUser): Promise<{ items: Experience[] }> {
    this.assertUser(user);
    return { items: await this.operator.listExperiences(user.id) };
  }

  @AnyRole(Role.TOUR_OPERATOR, Role.HOTEL_MANAGER, Role.EXPERIENCE_PROVIDER, Role.TRANSPORT_COMPANY)
  @Post("me/experiences")
  async createExperience(
    @CurrentUser() user?: SessionUser,
    @Body(new ZodValidationPipe(experienceCreateSchema)) body?: z.infer<typeof experienceCreateSchema>,
  ): Promise<{ experience: Experience }> {
    this.assertUser(user);
    this.assertBody(body);
    return { experience: await this.operator.createExperience(user.id, body) };
  }

  @AnyRole(Role.TOUR_OPERATOR, Role.HOTEL_MANAGER, Role.EXPERIENCE_PROVIDER, Role.TRANSPORT_COMPANY)
  @Patch("me/experiences/:id")
  async updateExperience(
    @CurrentUser() user?: SessionUser,
    @Param(new ZodValidationPipe(idParamSchema)) params?: z.infer<typeof idParamSchema>,
    @Body(new ZodValidationPipe(experienceUpdateSchema)) body?: z.infer<typeof experienceUpdateSchema>,
  ): Promise<{ experience: Experience }> {
    this.assertUser(user);
    this.assertParams(params);
    this.assertBody(body);
    return { experience: await this.operator.updateExperience(user.id, params.id, body) };
  }

  @AnyRole(Role.TOUR_OPERATOR, Role.HOTEL_MANAGER, Role.EXPERIENCE_PROVIDER, Role.TRANSPORT_COMPANY)
  @Delete("me/experiences/:id")
  async deleteExperience(
    @CurrentUser() user?: SessionUser,
    @Param(new ZodValidationPipe(idParamSchema)) params?: z.infer<typeof idParamSchema>,
  ): Promise<{ message: string }> {
    this.assertUser(user);
    this.assertParams(params);
    await this.operator.deleteExperience(user.id, params.id);
    return { message: "Experience deleted" };
  }

  private assertUser(user?: SessionUser): asserts user is SessionUser {
    if (!user) throw ApiError.unauthorized();
  }

  private assertBody<T>(body?: T): asserts body is T {
    if (!body) throw ApiError.badRequest("Missing body");
  }

  private assertParams(params?: z.infer<typeof idParamSchema>): asserts params is z.infer<typeof idParamSchema> {
    if (!params) throw ApiError.badRequest("Missing id");
  }
}
