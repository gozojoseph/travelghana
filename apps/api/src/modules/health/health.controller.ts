import { Controller, Get } from "@nestjs/common";

import { HealthResponse } from "@travelghana/types";

@Controller("health")
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: "ok",
      service: "travelghana-api",
      timestamp: new Date().toISOString(),
    };
  }
}
