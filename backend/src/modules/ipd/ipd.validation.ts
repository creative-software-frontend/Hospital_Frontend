import { z } from "zod";

export const createAdmissionSchema = z.object({
  patientId: z.number().int().positive(),
  doctorId: z.number().int().positive().optional(),
  bedId: z.number().int().positive().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  expectedDischargeDate: z.string().datetime({ offset: true }).optional(),
});
export type CreateAdmissionInput = z.infer<typeof createAdmissionSchema>;

export const dischargeAdmissionSchema = z.object({
  dischargeDate: z.string().datetime({ offset: true }).optional(),
  notes: z.string().optional(),
  finalizeInvoice: z.boolean().default(true),
});
export type DischargeAdmissionInput = z.infer<typeof dischargeAdmissionSchema>;

export const transferBedSchema = z.object({
  newBedId: z.number().int().positive(),
  reason: z.string().optional(),
});
export type TransferBedInput = z.infer<typeof transferBedSchema>;

export const listAdmissionsQuerySchema = z.object({
  status: z.enum(["ADMITTED", "TRANSFERRED", "DISCHARGED", "CANCELLED"]).optional(),
  patientId: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  doctorId: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default("20"),
});
export type ListAdmissionsQuery = z.infer<typeof listAdmissionsQuerySchema>;
