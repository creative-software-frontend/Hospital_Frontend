import { z } from "zod";

export const DEPARTMENT_STATUS_VALUES = ["active", "inactive"] as const;

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const departmentIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid department id"),
});

export const listDepartmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum(DEPARTMENT_STATUS_VALUES).optional(),
  departmentType: z.string().trim().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
  code: z.string().trim().min(1, "code is required").max(32),
  description: optionalString(500),
  departmentType: optionalString(64),
  status: z.enum(DEPARTMENT_STATUS_VALUES).optional(),
});

export const updateDepartmentSchema = createDepartmentSchema
  .omit({ code: true })
  .partial();

export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;