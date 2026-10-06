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
  /**
   * Like BusinessRuleError, `details` carries either a flat `{ field: message }`
   * map (so a form can highlight the offending input) or structured payload the
   * client needs to act on, such as the existing records a duplicate check found.
   */
  constructor(message = "Resource conflict", details?: unknown) {
    super(409, message, "CONFLICT", details);
  }
}

export class BusinessRuleError extends ApiError {
  /**
   * `details` uses the same flat `{ field: message }` shape as ValidationError
   * when a rule rejects one specific input, so clients can highlight the field
   * that caused it instead of showing an unattributable banner.
   */
  constructor(message: string, details?: unknown) {
    super(422, message, "BUSINESS_RULE", details);
  }
}

/**
 * The caller is authenticated but not permitted to perform this action until a
 * prerequisite is met (for example an expired password must be changed). The
 * machine-readable code lets the frontend route to a "set a new password" screen
 * instead of showing a generic failure.
 */
export class PrerequisiteError extends ApiError {
  constructor(message: string, code = "PREREQUISITE_REQUIRED", details?: unknown) {
    super(403, message, code, details);
  }
}
