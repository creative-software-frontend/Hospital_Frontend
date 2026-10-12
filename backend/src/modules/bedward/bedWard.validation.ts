import { z } from "zod";
import { BED_WARD_KINDS } from "./bedWard.registry";

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const bedWardKindParamSchema = z.object({
  kind: z.enum(BED_WARD_KINDS),
});

export const bedWardIdParamSchema = z.object({
  kind: z.enum(BED_WARD_KINDS),
  id: z.coerce.number().int().positive("Invalid id"),
});

export const listBedWardQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createBedWardSchema = z.object({
  branchId: z.coerce.number().int().positive("branchId is required"),
  name: z.string().trim().min(1, "name is required").max(255),
  code: z.string().trim().min(1, "code is required").max(32),
  description: optionalString(500),
});

// `code` and `branchId` are fixed once a list item exists.
export const updateBedWardSchema = createBedWardSchema.omit({ branchId: true, code: true }).partial();

export type ListBedWardQuery = z.infer<typeof listBedWardQuerySchema>;
export type CreateBedWardInput = z.infer<typeof createBedWardSchema>;
export type UpdateBedWardInput = z.infer<typeof updateBedWardSchema>;
