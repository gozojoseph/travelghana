import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { z, ZodTypeAny } from "zod";

import { ApiError } from "../errors/api-error";

/**
 * Validates request bodies with shared zod schemas (packages/validation) and
 * replaces the value with the parsed result — one source of truth for both
 * client forms and API validation.
 */
@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw ApiError.badRequest("Validation failed", "VALIDATION_ERROR", {
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
          code: i.code,
        })),
      });
    }
    return result.data;
  }
}
