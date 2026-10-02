import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

import { ApiError } from "../errors/api-error";

/**
 * Serializes every error to the shared ApiErrorResponse contract
 * ({@link ../docs/ERD.md} §types: ApiErrorResponse) so web/admin always get
 * { error: { code, message, details? } }.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "Something went wrong";
    let details: unknown;

    if (exception instanceof ApiError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const b = body as Record<string, unknown>;
        message = typeof b.message === "string" ? b.message : Array.isArray(b.message) ? b.message.join("; ") : message;
        code = typeof b.code === "string" ? b.code : code;
        details = b.statusCode !== undefined ? undefined : b.details;
      }
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) code = "INTERNAL_ERROR";
    }

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? `${exception.message}\n${exception.stack}` : String(exception),
      );
    }

    res.status(status).json({ error: { code, message, ...(details !== undefined ? { details } : {}) } });
  }
}
