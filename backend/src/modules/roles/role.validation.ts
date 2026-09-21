import { z } from "zod";

export const listRolesQuerySchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const roleIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid id"),
});

export const updateRolePermissionsSchema = z.object({
  permissionIds: z.array(z.coerce.number().int().positive()).min(1),
});

export type ListRolesQuery = z.infer<typeof listRolesQuerySchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
