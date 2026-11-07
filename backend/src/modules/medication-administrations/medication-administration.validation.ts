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

export const MEDICATION_ADMINISTRATION_STATUSES = ["GIVEN", "HELD", "REFUSED", "MISSED"] as const;
export type MedicationAdministrationStatusValue = (typeof MEDICATION_ADMINISTRATION_STATUSES)[number];

export const medicationAdministrationIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid medication administration id"),
});

export const listMedicationAdministrationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  patientId: z.coerce.number().int().positive().optional(),
  status: z.enum(MEDICATION_ADMINISTRATION_STATUSES).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const listPrescribedMedicationsQuerySchema = z.object({
  patientId: z.coerce.number().int().positive("patientId is required"),
  status: z.enum(["ACTIVE", "PARTIALLY_DISPENSED", "DISPENSED", "CANCELLED"]).optional(),
});

export const createMedicationAdministrationSchema = z
  .object({
    patientId: z.coerce.number().int().positive("patientId is required"),
    nurseId: z.coerce.number().int().positive().optional().nullable(),
    admissionId: z.coerce.number().int().positive().optional().nullable(),
    prescriptionItemId: z.coerce.number().int().positive().optional().nullable(),
    medicineId: z.coerce.number().int().positive().optional().nullable(),
    medicineName: z.string().trim().min(1).max(191, "Medicine name must be 191 characters or fewer").optional().nullable(),
    dosage: z.string().trim().max(191, "Dosage must be 191 characters or fewer").optional().nullable(),
    route: z.string().trim().max(191, "Route must be 191 characters or fewer").optional().nullable(),
    status: z.enum(MEDICATION_ADMINISTRATION_STATUSES).default("GIVEN"),
    administeredAt: optionalDate,
    notes: z.string().trim().max(500, "Notes must be 500 characters or fewer").optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const hasItem = value.prescriptionItemId !== null && value.prescriptionItemId !== undefined;
    const hasName = !!value.medicineName && value.medicineName.trim().length > 0;
    if (!hasItem && !hasName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either a prescription item or a medicine name is required",
        path: ["medicineName"],
      });
    }
  });

export const updateMedicationAdministrationSchema = createMedicationAdministrationSchema
  .innerType()
  .omit({ patientId: true })
  .partial();

export type ListMedicationAdministrationsQuery = z.infer<typeof listMedicationAdministrationsQuerySchema>;
export type CreateMedicationAdministrationInput = z.infer<typeof createMedicationAdministrationSchema>;
export type UpdateMedicationAdministrationInput = z.infer<typeof updateMedicationAdministrationSchema>;
export type ListPrescribedMedicationsQuery = z.infer<typeof listPrescribedMedicationsQuerySchema>;
export type PrescribedMedicationRow = {
  prescriptionId: number;
  prescriptionNumber: string;
  prescriptionStatus: string;
  itemId: number;
  medicineId: number;
  medicineName: string;
  medicineCode: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instruction: string | null;
  route: string | null;
  quantity: number | null;
};
