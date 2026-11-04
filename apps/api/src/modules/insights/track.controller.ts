import { Body, Controller, Post } from "@nestjs/common";
import type { TrackEventBatchInput } from "@travelghana/validation";
import { trackEventBatchSchema } from "@travelghana/validation";

import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedRequest } from "../../common/guards/session.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { InsightsService } from "./insights.service";

/**
 * /api/track — public clickstream collector (D37). The global SessionGuard
 * still resolves the session cookie on public routes, so signed-in visitors
 * are correlated with their userId even without authentication.
 */
@Controller("track")
export class TrackController {
  constructor(private readonly insights: InsightsService) {}

  @Public()
  @Post()
  async record(
    @Body(new ZodValidationPipe(trackEventBatchSchema)) body: TrackEventBatchInput,
    @CurrentUser() user?: AuthenticatedRequest["user"],
  ): Promise<{ accepted: number }> {
    const accepted = await this.insights.record(body.events, user?.id ?? null);
    return { accepted };
  }
}
