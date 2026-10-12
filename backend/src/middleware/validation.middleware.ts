import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { ValidationError } from "../errors/ApiError";

type SchemaSource = ZodSchema | ((req: Request) => ZodSchema);

interface ValidationSources {
  body?: SchemaSource;
  query?: SchemaSource;
  params?: SchemaSource;
}

/**
 * Validates the request against Zod schemas. A source may be a factory that
 * picks a schema from the request (e.g. per `:kind`) — the factory runs first,
 * then the chosen schema is parsed. On failure it throws a ValidationError with
 * a consistent structure (field-level details).
 */
export function validate(sources: ValidationSources) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (sources.body) {
      const schema = typeof sources.body === "function" ? sources.body(req) : sources.body;
      const result = schema.safeParse(req.body);
      if (!result.success) {
        throw new ValidationError("Invalid request body", flattenIssues(result.error));
      }
      req.body = result.data;
    }

    if (sources.query) {
      const schema = typeof sources.query === "function" ? sources.query(req) : sources.query;
      const result = schema.safeParse(req.query);
      if (!result.success) {
        throw new ValidationError("Invalid query parameters", flattenIssues(result.error));
      }
      req.validatedQuery = result.data;
    }

    if (sources.params) {
      const schema = typeof sources.params === "function" ? sources.params(req) : sources.params;
      const result = schema.safeParse(req.params);
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
