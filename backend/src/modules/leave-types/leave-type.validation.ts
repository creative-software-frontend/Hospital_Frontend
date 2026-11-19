import { z } from "zod";

export const LEAVE_TYPE_STATUS_VALUES = ["active", "inactive"] as const;

const leaveTypeFields = z.object({
  name: z.string().trim().min(1, "name is required").max(100),
  daysAllowed: z.coerce.number().int().min(0).max(365).optional(),
  paid: z.boolean().optional(),
  status: z.enum(LEAVE_TYPE_STATUS_VALUES).optional(),
});

export const leaveTypeIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid leave type id"),
});

export const listLeaveTypesQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(LEAVE_TYPE_STATUS_VALUES).optional(),
});

export const createLeaveTypeSchema = leaveTypeFields;
export const updateLeaveTypeSchema = leaveTypeFields.partial();

export type ListLeaveTypesQuery = z.infer<typeof listLeaveTypesQuerySchema>;
export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;
