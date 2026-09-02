import { z } from "zod";

export const BRANCH_STATUS_VALUES = ["active", "inactive"] as const;

const phoneSchema = z
  .string()
  .trim()
  .max(32, "Phone must be at most 32 characters")
  .regex(/^[0-9+\-\s()]*$/, "Phone contains invalid characters")
  .optional()
  .or(z.literal("").transform(() => undefined));

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email")
  .max(255)
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const branchIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid branch id"),
});

export const listBranchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum(BRANCH_STATUS_VALUES).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255).optional(),
  registrationNo: optionalString(64),
  address: optionalString(500),
  city: optionalString(255),
  district: optionalString(255),
  country: optionalString(255),
  phone: phoneSchema,
  email: emailSchema,
  logo: optionalString(500),
  timezone: optionalString(64),
  currency: optionalString(8),
  status: z.enum(BRANCH_STATUS_VALUES).optional(),
});

export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;