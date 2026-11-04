import { Module } from "@nestjs/common";

import { AdminAuditController } from "./admin-audit.controller";
import { AdminAuditService } from "./admin-audit.service";
import { AdminDashboardController } from "./admin-dashboard.controller";
import { AdminDashboardService } from "./admin-dashboard.service";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { AdminNotificationsService } from "./admin-notifications.service";
import { AdminProvidersController } from "./admin-providers.controller";
import { AdminProvidersService } from "./admin-providers.service";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";

/**
 * Platform admin console (D20): dashboard stats, users & roles, provider
 * verification, the audit trail, and the notification outbox. Every route is
 * @AnyRole(Role.ADMIN) — the single-role model from D20; AdminGate in the web
 * app is UX only and never the security boundary.
 */
@Module({
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminProvidersController,
    AdminAuditController,
    AdminNotificationsController,
  ],
  providers: [
    AdminDashboardService,
    AdminUsersService,
    AdminProvidersService,
    AdminAuditService,
    AdminNotificationsService,
  ],
})
export class AdminModule {}
