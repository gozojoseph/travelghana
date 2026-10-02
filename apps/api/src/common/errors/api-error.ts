/**
 * Central API error type (§51: validation + error handling). Services throw
 * ApiError; the exception filter serializes it to the shared ApiErrorResponse shape.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, code = "BAD_REQUEST", details?: unknown) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = "Authentication required", code = "UNAUTHORIZED") {
    return new ApiError(401, code, message);
  }

  static forbidden(message = "You do not have permission to do that", code = "FORBIDDEN") {
    return new ApiError(403, code, message);
  }

  static notFound(message = "Resource not found", code = "NOT_FOUND") {
    return new ApiError(404, code, message);
  }

  static conflict(message: string, code = "CONFLICT", details?: unknown) {
    return new ApiError(409, code, message, details);
  }
}
