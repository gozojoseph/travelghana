import { Controller, Get } from "@nestjs/common";

import { HealthResponse } from "@travelghana/types";

import { Public } from "../../common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  /**
   * Public so uptime checks, load balancers and container orchestrators can
   * reach it. This endpoint is deliberately unauthenticated and therefore must
   * stay trivial — it is a liveness probe, not a diagnostics dump. Do not add
   * dependency/database details here without a separate, authenticated route.
   */
  @Public()
  @Get()
  check(): HealthResponse {
    return {
      status: "ok",
      service: "travelghana-api",
      timestamp: new Date().toISOString(),
    };
  }
}