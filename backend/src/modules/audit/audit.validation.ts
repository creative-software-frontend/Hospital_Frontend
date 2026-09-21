import { z } from "zod";

export const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  module: z.string().trim().optional(),
  action: z.string().trim().optional(),
  userId: z.coerce.number().int().positive().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;