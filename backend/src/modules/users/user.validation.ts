import { z } from "zod";

const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(255);

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid id"),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  branchId: z.coerce.number().int().positive().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"]).optional(),
  role: z.string().optional(),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  email: z.string().trim().toLowerCase().email("Invalid email").max(255),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, dot, dash and underscore"),
  password: passwordSchema,
  phone: z.string().trim().max(32).optional().or(z.literal("").transform(() => undefined)),
  branchId: z.coerce.number().int().positive().optional(),
  roleIds: z.array(z.coerce.number().int().positive()).min(1, "At least one role is required"),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255).optional(),
  email: z.string().trim().toLowerCase().email("Invalid email").max(255).optional(),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, dot, dash and underscore")
    .optional(),
  phone: z.string().trim().max(32).optional().or(z.literal("").transform(() => undefined)),
  roleIds: z.array(z.coerce.number().int().positive()).min(1, "At least one role is required").optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
