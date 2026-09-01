/**
 * Base application error with an HTTP status code and a machine-readable code.
 * Different error kinds are distinguishable by `code` so the centralized error
 * middleware can format responses consistently.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = "ERROR", details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = "Authentication required") {
    super(401, message, "UNAUTHENTICATED");
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = "You do not have permission to perform this action") {
    super(403, message, "FORBIDDEN");
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(404, message, "NOT_FOUND");
  }
}

export class ValidationError extends ApiError {
  constructor(message = "Invalid input", details?: unknown) {
    super(400, message, "VALIDATION_ERROR", details);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Resource conflict") {
    super(409, message, "CONFLICT");
  }
}

export class BusinessRuleError extends ApiError {
  constructor(message: string) {
    super(422, message, "BUSINESS_RULE");
  }
}
