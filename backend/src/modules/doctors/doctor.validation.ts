import { z } from "zod";

export const DOCTOR_STATUS_VALUES = ["active", "inactive"] as const;
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

const optionalDecimal = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid amount (max 2 decimals)")
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => undefined));

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().nullable();

// An optional calendar date arriving as an ISO string (YYYY-MM-DD). An empty
// string collapses to undefined; `null` clears the value on update; a future
// date is rejected.
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

export const doctorIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid doctor id"),
});

export const listDoctorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum(DOCTOR_STATUS_VALUES).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const doctorFieldsSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  specialization: optionalString(255),
  qualification: optionalString(255),
  bmdcRegistrationNo: optionalString(64),
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
  consultationFee: optionalDecimal(16),
  followupFee: optionalDecimal(16),
  emergencyFee: optionalDecimal(16),
  commissionType: z.enum(["PERCENT", "FIXED"]).optional().nullable(),
  commissionValue: optionalDecimal(16),
  status: z.enum(DOCTOR_STATUS_VALUES).optional(),
});

// Every doctor is created together with a linked login account, so the email
// (the account identifier) and the password are mandatory on create. The
// refines keep field-level messages instead of a single opaque banner.
export const createDoctorSchema = doctorFieldsSchema
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

export const updateDoctorSchema = doctorFieldsSchema.partial();

export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;