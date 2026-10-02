import { Module } from "@nestjs/common";

import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { ConsoleMailer, MAILER } from "./mailer";

@Module({
  controllers: [AuthController],
  providers: [{ provide: MAILER, useClass: ConsoleMailer }, AuthService],
  exports: [AuthService],
})
export class AuthModule {}
