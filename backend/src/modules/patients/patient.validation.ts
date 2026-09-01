import { z } from "zod";

export const GENDER_VALUES = ["MALE", "FEMALE", "OTHER"] as const;
export const BLOOD_GROUP_VALUES = [
  "A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG",
] as const;
export const MARITAL_STATUS_VALUES = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"] as const;
export const PATIENT_STATUS_VALUES = ["active", "inactive"] as const;

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

export const patientIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid patient id"),
});

export const contactIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid patient id"),
  contactId: z.coerce.number().int().positive("Invalid contact id"),
});

export const listPatientsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  patientCode: z.string().trim().max(64).optional(),
  name: z.string().trim().max(255).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().max(255).optional(),
  gender: z.enum(GENDER_VALUES).optional(),
  status: z.enum(PATIENT_STATUS_VALUES).optional(),
  branchId: z.coerce.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createPatientSchema = z.object({
  patientCode: z.string().trim().min(1, "patientCode is required").max(64),
  firstName: z.string().trim().min(1, "firstName is required").max(255),
  lastName: optionalString(255),
  dateOfBirth: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
    .transform((v) => new Date(v))
    .refine((d) => d <= new Date(), "dateOfBirth cannot be in the future")
    .optional(),
  gender: z.enum(GENDER_VALUES).optional(),
  bloodGroup: z.enum(BLOOD_GROUP_VALUES).optional(),
  maritalStatus: z.enum(MARITAL_STATUS_VALUES).optional(),
  phone: phoneSchema,
  email: emailSchema,
  address: optionalString(500),
  district: optionalString(255),
  nationalId: optionalString(64),
  occupation: optionalString(255),
  photo: optionalString(500),
  branchId: z.coerce.number().int().positive().optional(),
  contacts: z
    .array(
      z.object({
        name: z.string().trim().min(1, "name is required").max(255),
        relationship: optionalString(255),
        phone: phoneSchema,
        address: optionalString(500),
        isPrimary: z.boolean().optional(),
      }),
    )
    .max(20, "A patient can have at most 20 contacts")
    .optional(),
});

export const updatePatientSchema = createPatientSchema
  .omit({ patientCode: true, branchId: true, contacts: true })
  .partial();

export const updatePatientStatusSchema = z.object({
  status: z.enum(PATIENT_STATUS_VALUES, { message: "Invalid patient status" }),
});

export const createContactSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
  relationship: optionalString(255),
  phone: phoneSchema,
  address: optionalString(500),
  isPrimary: z.boolean().optional(),
});

export const updateContactSchema = createContactSchema.partial();

export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type UpdatePatientStatusInput = z.infer<typeof updatePatientStatusSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;