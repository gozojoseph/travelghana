import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";

import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  const webAppUrl = process.env.WEB_APP_URL ?? "http://localhost:3000";
  const adminAppUrl = process.env.ADMIN_APP_URL ?? "http://localhost:3001";
  app.enableCors({
    origin: [webAppUrl, adminAppUrl],
    credentials: true, // session cookies (§40)
  });

  app.use(cookieParser());
  app.setGlobalPrefix("api");
  // Validation: shared zod schemas via ZodValidationPipe per route — single
  // source of truth (packages/validation), no second DTO validation stack.

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);

  new Logger("Bootstrap").log(`TravelGhana API listening on :${port}`);
}

void bootstrap();
