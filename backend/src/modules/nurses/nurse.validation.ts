import { z } from "zod";

export const NURSE_STATUS_VALUES = ["active", "inactive"] as const;

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .or(z.literal("").transform(() => undefined));

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

export const nurseIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid nurse id"),
});

export const listNursesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum(NURSE_STATUS_VALUES).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  shiftTypeId: z.coerce.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const nurseFieldsSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  shiftTypeId: z.coerce.number().int().positive().optional().nullable(),
  qualification: optionalString(255),
  registrationNo: optionalString(64),
  phone: phoneSchema,
  email: emailSchema,
  status: z.enum(NURSE_STATUS_VALUES).optional(),
});

// Every nurse is created together with a linked login account, so the email
// (the account identifier) and the password are mandatory on create. The
// refines keep field-level messages instead of a single opaque banner.
export const createNurseSchema = nurseFieldsSchema
  .extend({
    email: z.string().trim().toLowerCase().email("Invalid email").max(255),
    password: z.string().trim().min(8, "Password must be at least 8 characters").max(255),
    confirmPassword: optionalString(255),
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword !== data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export const updateNurseSchema = nurseFieldsSchema.partial();

export type ListNursesQuery = z.infer<typeof listNursesQuerySchema>;
export type CreateNurseInput = z.infer<typeof createNurseSchema>;
export type UpdateNurseInput = z.infer<typeof updateNurseSchema>;
