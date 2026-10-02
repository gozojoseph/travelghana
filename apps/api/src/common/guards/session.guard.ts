import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { ApiError } from "../errors/api-error";
import { ROLES_KEY, Roles } from "../decorators/roles.decorator";
import { AuthService } from "../../modules/auth/auth.service";
import { Reflector } from "@nestjs/core";
import { Role } from "@travelghana/database";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
    roles: Role[];
  };
}

/**
 * Session-cookie authentication + role-based authorization in one guard.
 * Routes marked @Public() skip authentication; routes with @Roles(...) require
 * the authenticated user to hold every listed role (active memberships).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await this.authService.resolveSession(request);
    request.user = session?.user;

    if (isPublic) return true;
    if (!session) throw ApiError.unauthorized();

    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0) {
      const held = new Set(session.user.roles);
      const missing = requiredRoles.filter((r) => !held.has(r));
      if (missing.length > 0) throw ApiError.forbidden();
    }

    return true;
  }
}

export const IS_PUBLIC_KEY = "isPublic";
