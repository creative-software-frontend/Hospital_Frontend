import { z } from "zod";

export const CHAMBER_STATUS_VALUES = ["active", "inactive"] as const;

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => undefined));

export const chamberIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid chamber id"),
});

export const listChambersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum(CHAMBER_STATUS_VALUES).optional(),
  doctorId: z.coerce.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createChamberSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
  code: z.string().trim().min(1, "code is required").max(32),
  location: optionalString(255),
  description: optionalString(500),
  doctorId: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(CHAMBER_STATUS_VALUES).optional(),
});

export const updateChamberSchema = createChamberSchema
  .omit({ code: true })
  .partial();

export type ListChambersQuery = z.infer<typeof listChambersQuerySchema>;
export type CreateChamberInput = z.infer<typeof createChamberSchema>;
export type UpdateChamberInput = z.infer<typeof updateChamberSchema>;
