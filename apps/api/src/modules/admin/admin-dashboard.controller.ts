import { Controller, Get } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type { AdminStats } from "@travelghana/types";

import { AnyRole } from "../../common/decorators/roles.decorator";

import { AdminDashboardService } from "./admin-dashboard.service";

/** Dashboard home — the single place an admin sees everything at a glance. */
@Controller("admin")
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get("stats")
  @AnyRole(Role.ADMIN)
  async stats(): Promise<{ stats: AdminStats }> {
    return { stats: await this.dashboard.stats() };
  }
}
