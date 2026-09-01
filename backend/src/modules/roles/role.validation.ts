import { z } from "zod";

export const listRolesQuerySchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const roleIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid id"),
});

export type ListRolesQuery = z.infer<typeof listRolesQuerySchema>;
