import { Body, Controller, Get, Patch } from "@nestjs/common";
import type { SessionUser, UserCounts } from "@travelghana/types";
import { updateProfileSchema } from "@travelghana/validation";
import { z } from "zod";

import { ApiError } from "../../common/errors/api-error";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { AuthService } from "../auth/auth.service";
import { UsersService } from "./users.service";

/** Routes under /api/users — the "My TravelGhana" profile surface (§19). */
@Controller("users")
export class UsersController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get("profile")
  async profile(@CurrentUser() user?: SessionUser): Promise<{ user: SessionUser }> {
    if (!user) throw ApiError.unauthorized();
    return { user };
  }

  @Get("counts")
  async counts(@CurrentUser() user?: SessionUser): Promise<{ counts: UserCounts }> {
    if (!user) throw ApiError.unauthorized();
    return { counts: await this.usersService.counts(user.id) };
  }

  @Patch("profile")
  async updateProfile(
    @CurrentUser() user?: SessionUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body?: z.infer<typeof updateProfileSchema>,
  ): Promise<{ user: SessionUser }> {
    if (!user) throw ApiError.unauthorized();
    if (!body) throw ApiError.badRequest("Missing body");
    return { user: await this.authService.updateProfile(user.id, body) };
  }
}
