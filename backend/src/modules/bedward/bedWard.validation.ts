import { z } from "zod";
import { BED_WARD_KINDS, type BedWardKind } from "./bedWard.registry";

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .or(z.literal("").transform(() => undefined));

const nameField = z.string().trim().min(1, "name is required").max(255);
const branchIdField = z.coerce.number().int().positive("branchId is required");
const requiredRef = (label: string) =>
  z.coerce.number().int().positive(`${label} is required`);
const optionalRef = (label: string) =>
  z.coerce.number().int().positive(`Invalid ${label}`).optional();

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

const createSchemas = {
  floors: z.object({
    branchId: branchIdField,
    name: nameField,
    description: optionalString(500),
  }),
  "bed-types": z.object({
    branchId: branchIdField,
    name: nameField,
  }),
  "bed-groups": z.object({
    branchId: branchIdField,
    name: nameField,
    floorId: requiredRef("floorId"),
    color: optionalString(20),
    description: optionalString(500),
  }),
  "bed-statuses": z.object({
    branchId: branchIdField,
    name: nameField,
  }),
  beds: z.object({
    branchId: branchIdField,
    name: nameField,
    bedTypeId: requiredRef("bedTypeId"),
    bedGroupId: requiredRef("bedGroupId"),
    notAvailableForUse: z.boolean().optional(),
  }),
} as const;

// `branchId` is fixed once a list item exists; every other field is optional.
const updateSchemas = {
  floors: createSchemas.floors.omit({ branchId: true }).partial(),
  "bed-types": createSchemas["bed-types"].omit({ branchId: true }).partial(),
  "bed-groups": createSchemas["bed-groups"].omit({ branchId: true }).partial(),
  "bed-statuses": createSchemas["bed-statuses"].omit({ branchId: true }).partial(),
  beds: createSchemas.beds.omit({ branchId: true }).partial(),
};

export const createBedWardSchemaByKind: Record<BedWardKind, z.ZodTypeAny> = createSchemas;
export const updateBedWardSchemaByKind: Record<BedWardKind, z.ZodTypeAny> = updateSchemas;

export type ListBedWardQuery = z.infer<typeof listBedWardQuerySchema>;

/** Sanitised create payload any kind may carry (only the relevant fields are set). */
export interface CreateBedWardInput {
  branchId: number;
  name: string;
  description?: string;
  color?: string;
  floorId?: number;
  bedTypeId?: number;
  bedGroupId?: number;
  notAvailableForUse?: boolean;
}

export type UpdateBedWardInput = Partial<Omit<CreateBedWardInput, "branchId">>;
