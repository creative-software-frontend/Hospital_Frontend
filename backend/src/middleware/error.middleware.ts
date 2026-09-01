import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ApiError } from "../errors/ApiError";
import { config } from "../config";

interface ErrorResponse {
  success: false;
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Centralized error handler. Translates known error types into consistent
 * JSON responses and never leaks Prisma stack traces / database credentials
 * to clients. In production, unexpected errors are logged server-side and a
 * generic message is returned.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  } satisfies ErrorResponse);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Our own application errors (auth, authorization, not-found, validation, business rule, conflict)
  if (err instanceof ApiError) {
    const body: ErrorResponse = { success: false, message: err.message, code: err.code };
    if (err.details !== undefined) {
      body.details = err.details;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  // Known Prisma client errors -> tidy, non-sensitive messages
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(err);
    res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      code: mapped.code,
    } satisfies ErrorResponse);
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      message: "Invalid data supplied to the database",
      code: "DB_VALIDATION_ERROR",
    } satisfies ErrorResponse);
    return;
  }

  // Zod errors thrown directly (should normally be caught by validation middleware)
  if (err instanceof Error && "issues" in err && Array.isArray((err as { issues?: unknown }).issues)) {
    res.status(400).json({
      success: false,
      message: "Invalid input",
      code: "VALIDATION_ERROR",
    } satisfies ErrorResponse);
    return;
  }

  // Unexpected error
  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    message: config.isProduction ? "Internal server error" : "Internal server error",
  } satisfies ErrorResponse);
}

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
  status: number;
  message: string;
  code: string;
} {
  switch (err.code) {
    case "P2002":
      return {
        status: 409,
        message: "A record with the same unique value already exists",
        code: "UNIQUE_CONSTRAINT",
      };
    case "P2003":
      return {
        status: 400,
        message: "The referenced record does not exist",
        code: "FOREIGN_KEY_VIOLATION",
      };
    case "P2025":
      return {
        status: 404,
        message: "Record not found",
        code: "RECORD_NOT_FOUND",
      };
    case "P2014":
      return {
        status: 400,
        message: "Invalid relation change",
        code: "RELATION_VIOLATION",
      };
    default:
      return { status: 400, message: "Database error", code: "DATABASE_ERROR" };
  }
}
