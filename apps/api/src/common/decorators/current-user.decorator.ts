import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import { AuthenticatedRequest } from "../guards/session.guard";

/** Current authenticated user (set by SessionGuard). Throws in guard-protected routes only. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
