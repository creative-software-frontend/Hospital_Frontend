import { z } from "zod";

export const SUPPLIER_STATUS_VALUES = ["active", "inactive"] as const;
export type SupplierStatusValue = (typeof SUPPLIER_STATUS_VALUES)[number];

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => undefined));

export const supplierIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid supplier id"),
});

export const listSuppliersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum(SUPPLIER_STATUS_VALUES).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
  mobile: optionalString(255),
  address: optionalString(2000),
  balance: z.coerce.number().finite().optional().nullable(),
  status: z.enum(SUPPLIER_STATUS_VALUES).optional(),
  // Legacy "shop" bucket; service defaults new rows to 3 (the imported majority).
  shop: z.coerce.number().int().min(1).max(100).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
