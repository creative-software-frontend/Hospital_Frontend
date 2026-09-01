import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { ValidationError } from "../errors/ApiError";

interface ValidationSources {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validates the request against Zod schemas. On failure it throws a
 * ValidationError with a consistent structure (field-level details).
 */
export function validate(sources: ValidationSources) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (sources.body) {
      const result = sources.body.safeParse(req.body);
      if (!result.success) {
        throw new ValidationError("Invalid request body", flattenIssues(result.error));
      }
      req.body = result.data;
    }

    if (sources.query) {
      const result = sources.query.safeParse(req.query);
      if (!result.success) {
        throw new ValidationError("Invalid query parameters", flattenIssues(result.error));
      }
      req.validatedQuery = result.data;
    }

    if (sources.params) {
      const result = sources.params.safeParse(req.params);
      if (!result.success) {
        throw new ValidationError("Invalid path parameters", flattenIssues(result.error));
      }
    }

    next();
  });
}

function flattenIssues(error: {
  issues: Array<{ path: (string | number)[]; message: string }>;
}): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    details[key] = issue.message;
  }
  return details;
}
