import { Controller, Get, Param, Query } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type {
  AdminInsightSessionDetail,
  AdminInsightSessionsResult,
  AdminInsightsResult,
} from "@travelghana/types";
import {
  adminInsightSessionsQuerySchema,
  adminInsightsQuerySchema,
  insightSessionParamSchema,
  type AdminInsightSessionsQuery,
  type AdminInsightsQuery,
  type InsightSessionParam,
} from "@travelghana/validation";

import { AnyRole } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { InsightsService } from "./insights.service";

/** /api/admin/insights — visitor clickstream aggregates (D37). */
@Controller("admin/insights")
export class AdminInsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  @AnyRole(Role.ADMIN)
  async summary(
    @Query(new ZodValidationPipe(adminInsightsQuerySchema)) query: AdminInsightsQuery,
  ): Promise<AdminInsightsResult> {
    return this.insights.summary(query);
  }

  @Get("sessions")
  @AnyRole(Role.ADMIN)
  async sessions(
    @Query(new ZodValidationPipe(adminInsightSessionsQuerySchema))
    query: AdminInsightSessionsQuery,
  ): Promise<AdminInsightSessionsResult> {
    return this.insights.sessions(query);
  }

  @Get("sessions/:sessionId")
  @AnyRole(Role.ADMIN)
  async sessionTimeline(
    @Param(new ZodValidationPipe(insightSessionParamSchema)) params: InsightSessionParam,
  ): Promise<AdminInsightSessionDetail> {
    return this.insights.sessionTimeline(params.sessionId);
  }
}
