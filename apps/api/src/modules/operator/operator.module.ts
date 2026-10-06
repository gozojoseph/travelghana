import { Module } from "@nestjs/common";

import { OperatorController } from "./operator.controller";
import { OperatorService } from "./operator.service";

/** Operator self-service: provider onboarding + tour/experience listings (D5). */
@Module({
  controllers: [OperatorController],
  providers: [OperatorService],
})
export class OperatorModule {}
