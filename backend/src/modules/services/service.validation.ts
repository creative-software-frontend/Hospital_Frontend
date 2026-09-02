import { z } from "zod";

export const SERVICE_STATUS_VALUES = ["active", "inactive"] as const;

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

export const serviceIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid service id"),
});

export const listServicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum(SERVICE_STATUS_VALUES).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createServiceSchema = z.object({
  serviceCode: z.string().trim().min(1, "serviceCode is required").max(64),
  name: z.string().trim().min(1, "name is required").max(255),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  description: optionalString(500),
  price: optionalDecimal(16),
  taxPercent: optionalDecimal(6),
  discountAllowed: z.boolean().optional(),
  status: z.enum(SERVICE_STATUS_VALUES).optional(),
});

export const updateServiceSchema = createServiceSchema
  .omit({ serviceCode: true })
  .partial();

export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;