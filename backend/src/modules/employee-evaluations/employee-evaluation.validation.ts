import { z } from "zod";

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => undefined));

export const employeeEvaluationIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid evaluation id"),
});

export const listEmployeeEvaluationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createEmployeeEvaluationSchema = z.object({
  employeeId: z.coerce.number().int().positive("employeeId is required"),
  date: z.string().trim().min(1, "date is required"),
  rating: z.coerce.number().int().min(0).max(5).optional(),
  comments: optionalString(1000),
  status: z.enum(["active", "inactive"]).optional(),
});

export const updateEmployeeEvaluationSchema = z.object({
  rating: z.coerce.number().int().min(0).max(5).optional(),
  comments: optionalString(1000),
  status: z.enum(["active", "inactive"]).optional(),
});

export type ListEmployeeEvaluationsQuery = z.infer<typeof listEmployeeEvaluationsQuerySchema>;
export type CreateEmployeeEvaluationInput = z.infer<typeof createEmployeeEvaluationSchema>;
export type UpdateEmployeeEvaluationInput = z.infer<typeof updateEmployeeEvaluationSchema>;
