import { z } from "zod";

export const DOCTOR_STATUS_VALUES = ["active", "inactive"] as const;

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .or(z.literal("").transform(() => undefined));

const optionalDecimal = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid amount (max 2 decimals)")
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

export const createDoctorSchema = z.object({
  doctorCode: z.string().trim().min(1, "doctorCode is required").max(64),
  name: z.string().trim().min(1, "name is required").max(255),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  specialization: optionalString(255),
  qualification: optionalString(255),
  registrationNo: optionalString(64),
  phone: phoneSchema,
  email: emailSchema,
  consultationFee: optionalDecimal(16),
  followupFee: optionalDecimal(16),
  emergencyFee: optionalDecimal(16),
  commissionType: z.enum(["PERCENT", "FIXED"]).optional().nullable(),
  commissionValue: optionalDecimal(16),
  status: z.enum(DOCTOR_STATUS_VALUES).optional(),
});

export const updateDoctorSchema = createDoctorSchema
  .omit({ doctorCode: true })
  .partial();

export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;