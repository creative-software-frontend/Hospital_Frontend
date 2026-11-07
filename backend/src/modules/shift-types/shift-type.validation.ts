import { z } from "zod";

export const SHIFT_TYPE_STATUS_VALUES = ["active", "inactive"] as const;

const timeValue = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must use HH:MM format")
  .nullable()
  .optional();

const shiftTypeFields = z.object({
  name: z.string().trim().min(1, "name is required").max(100),
  startTime: timeValue,
  endTime: timeValue,
  graceMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  status: z.enum(SHIFT_TYPE_STATUS_VALUES).optional(),
});

export const shiftTypeIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid shift type id"),
});

export const listShiftTypesQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(SHIFT_TYPE_STATUS_VALUES).optional(),
});

export const createShiftTypeSchema = shiftTypeFields;
export const updateShiftTypeSchema = shiftTypeFields.partial();

export type ListShiftTypesQuery = z.infer<typeof listShiftTypesQuerySchema>;
export type CreateShiftTypeInput = z.infer<typeof createShiftTypeSchema>;
export type UpdateShiftTypeInput = z.infer<typeof updateShiftTypeSchema>;
