import { z } from "zod";

export const PRESCRIPTION_STATUSES = [
  "ACTIVE",
  "PARTIALLY_DISPENSED",
  "DISPENSED",
  "CANCELLED",
] as const;

export type PrescriptionStatusValue = (typeof PRESCRIPTION_STATUSES)[number];

const positiveId = z.coerce.number().int().positive();
const optionalText = (max: number) =>
  z.string().trim().max(max, `Must be ${max} characters or fewer`).optional().nullable();

export const prescriptionIdParamSchema = z.object({
  id: positiveId,
});

export const listPrescriptionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  patientId: positiveId.optional(),
  doctorId: positiveId.optional(),
  status: z.enum(PRESCRIPTION_STATUSES).optional(),
  search: z.string().trim().optional(),
});

const prescriptionItemFieldsSchema = z.object({
  dosage: optionalText(191),
  frequency: optionalText(191),
  duration: optionalText(191),
  instruction: optionalText(191),
  quantity: z.coerce.number().int().nonnegative("Quantity cannot be negative").optional().nullable(),
  route: optionalText(191),
});

export const createPrescriptionItemSchema = prescriptionItemFieldsSchema.extend({
  medicineId: positiveId,
});

const detailComplaintSchema = z.object({
  name: z.string().trim().max(191),
  duration: optionalText(191),
});

const detailVitalSchema = z.object({
  label: z.string().trim().max(64),
  value: z.string().trim().max(64),
});

/** A list of free-text / picked values for one clinical section. */
const detailStringList = z
  .array(z.string().trim().min(1).max(255))
  .max(50)
  .optional();

/**
 * Extra clinical context captured by the Digital Prescription composer that is
 * not part of the medicine items: complaints, examination vitals, advice and
 * follow-up. Stored as JSON so a saved prescription can be reprinted in full.
 */
export const prescriptionDetailsSchema = z
  .object({
    complaints: z.array(detailComplaintSchema).max(50).optional(),
    vitals: z.array(detailVitalSchema).max(20).optional(),
    advice: z.string().trim().max(2000).optional().nullable(),
    followUp: optionalText(191),
    referTo: optionalText(191),
    ACTIVITY_LEVEL: detailStringList,
    PAST_HISTORY: detailStringList,
    DRUG_HISTORY: detailStringList,
    INVESTIGATIONS: detailStringList,
    DIAGNOSIS: detailStringList,
    TREATMENT_PLAN: detailStringList,
    OPERATION_NOTES: detailStringList,
    PHYSIOTHERAPY: detailStringList,
    NEXT_PLANS: detailStringList,
    HOSPITALIZATIONS: detailStringList,
  })
  .optional()
  .nullable();

export const createPrescriptionSchema = z.object({
  patientId: positiveId,
  doctorId: positiveId,
  medicalRecordId: positiveId.optional().nullable(),
  notes: optionalText(191),
  details: prescriptionDetailsSchema,
  items: z
    .array(createPrescriptionItemSchema)
    .min(1, "At least one medicine is required")
    .max(100, "A prescription can contain at most 100 medicines"),
});

/**
 * Existing items must be identified by `id`. New items omit `id` and must carry
 * a `medicineId`. Removed items are intentionally not expressed here: an ACTIVE
 * prescription can be edited/appended, but dispensed or cancelled prescriptions
 * are immutable and a wrong item is handled by cancellation + re-prescribing.
 */
export const updatePrescriptionItemSchema = prescriptionItemFieldsSchema.extend({
  id: positiveId.optional(),
  medicineId: positiveId.optional(),
});

export const updatePrescriptionSchema = z
  .object({
    doctorId: positiveId.optional(),
    medicalRecordId: positiveId.optional().nullable(),
    notes: optionalText(191),
    details: prescriptionDetailsSchema,
    items: z
      .array(updatePrescriptionItemSchema)
      .min(1, "Provide at least one item to update")
      .max(100, "A prescription can contain at most 100 medicines")
      .optional(),
  })
  .superRefine((value, ctx) => {
    const hasScalarChange =
      value.doctorId !== undefined ||
      value.medicalRecordId !== undefined ||
      value.notes !== undefined ||
      value.details !== undefined;
    if (!hasScalarChange && value.items === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one field to update",
        path: [],
      });
    }

    value.items?.forEach((item, index) => {
      if (item.id === undefined && item.medicineId === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A new item requires medicineId",
          path: ["items", index, "medicineId"],
        });
        return;
      }

      // `{ id: 123 }` is a no-op. Requiring an actual field keeps the update
      // intent explicit while still allowing any one of the editable fields.
      const hasItemChange =
        item.medicineId !== undefined ||
        item.dosage !== undefined ||
        item.frequency !== undefined ||
        item.duration !== undefined ||
        item.instruction !== undefined ||
        item.quantity !== undefined ||
        item.route !== undefined;
      if (item.id !== undefined && !hasItemChange) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide at least one change for an existing item",
          path: ["items", index],
        });
      }
    });
  });

export type ListPrescriptionsQuery = z.infer<typeof listPrescriptionsQuerySchema>;
export type CreatePrescriptionItemInput = z.infer<typeof createPrescriptionItemSchema>;
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type UpdatePrescriptionItemInput = z.infer<typeof updatePrescriptionItemSchema>;
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema>;
