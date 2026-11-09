import { z } from "zod";

const optionalDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  });

export const bedTransferIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid bed transfer id"),
});

export const listBedTransfersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  patientId: z.coerce.number().int().positive().optional(),
  admissionId: z.coerce.number().int().positive().optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
});

export const createBedTransferSchema = z
  .object({
    patientId: z.coerce.number().int().positive("patientId is required"),
    admissionId: z.coerce.number().int().positive().optional().nullable(),
    fromBedId: z.coerce.number().int().positive("fromBedId is required"),
    toBedId: z.coerce.number().int().positive("toBedId is required"),
    transferDate: optionalDate,
    reason: z.string().trim().max(500, "Reason must be 500 characters or fewer").optional().nullable(),
    notes: z.string().trim().max(500, "Notes must be 500 characters or fewer").optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.fromBedId === value.toBedId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source and destination beds must be different",
        path: ["toBedId"],
      });
    }
  });

export const updateBedTransferSchema = createBedTransferSchema
  .innerType()
  .omit({ patientId: true, admissionId: true, fromBedId: true, toBedId: true })
  .partial();

export type ListBedTransfersQuery = z.infer<typeof listBedTransfersQuerySchema>;
export type CreateBedTransferInput = z.infer<typeof createBedTransferSchema>;
export type UpdateBedTransferInput = z.infer<typeof updateBedTransferSchema>;
