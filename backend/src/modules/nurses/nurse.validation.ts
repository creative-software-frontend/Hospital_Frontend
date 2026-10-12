import { z } from "zod";

export const NURSE_STATUS_VALUES = ["active", "inactive"] as const;
export const GENDER_VALUES = ["MALE", "FEMALE", "OTHER"] as const;
export const BLOOD_GROUP_VALUES = [
  "A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG",
] as const;
export const MARITAL_STATUS_VALUES = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"] as const;

// `.nullable()` is applied throughout so a form that clears a field by sending
// `null` is accepted (the create form sends `x || null` for empty inputs).
const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => undefined));

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().nullable();

const optionalDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
  .transform((v) => new Date(v))
  .refine((d) => d <= new Date(), "Date cannot be in the future")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => undefined));

const phoneSchema = z
  .string()
  .trim()
  .max(32, "Phone must be at most 32 characters")
  .regex(/^[0-9+\-\s()]*$/, "Phone contains invalid characters")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => undefined));

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email")
  .max(255)
  .optional()
  .nullable()
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
  joiningDate: optionalDate,
  gender: optionalEnum(GENDER_VALUES),
  dateOfBirth: optionalDate,
  maritalStatus: optionalEnum(MARITAL_STATUS_VALUES),
  bloodGroup: optionalEnum(BLOOD_GROUP_VALUES),
  photo: optionalString(500),
  signature: optionalString(500),
  cv: optionalString(500),
  phone: phoneSchema,
  email: emailSchema,
  permanentAddress: optionalString(500),
  presentAddress: optionalString(500),
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
