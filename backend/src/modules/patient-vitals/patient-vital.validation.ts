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

const optionalNumber = (min: number, max: number, label: string) =>
  z
    .coerce.number({ invalid_type_error: `${label} must be a number` })
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`)
    .optional();

export const patientVitalIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid vitals record id"),
});

export const listPatientVitalsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  patientId: z.coerce.number().int().positive().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const createPatientVitalSchema = z
  .object({
    patientId: z.coerce.number().int().positive("patientId is required"),
    nurseId: z.coerce.number().int().positive().optional().nullable(),
    admissionId: z.coerce.number().int().positive().optional().nullable(),
    recordedAt: optionalDate,
    temperature: optionalNumber(30, 45, "Temperature"),
    pulse: optionalNumber(20, 250, "Pulse"),
    systolic: optionalNumber(50, 300, "Systolic pressure"),
    diastolic: optionalNumber(20, 200, "Diastolic pressure"),
    respiratoryRate: optionalNumber(4, 80, "Respiratory rate"),
    spo2: optionalNumber(50, 100, "SpO2"),
    bloodSugar: optionalNumber(10, 800, "Blood sugar"),
    weight: optionalNumber(0.5, 500, "Weight"),
    notes: z.string().trim().max(500, "Notes must be 500 characters or fewer").optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const measurements = [
      value.temperature,
      value.pulse,
      value.systolic,
      value.diastolic,
      value.respiratoryRate,
      value.spo2,
      value.bloodSugar,
      value.weight,
    ];
    if (measurements.every((item) => item === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Record at least one measurement",
        path: ["temperature"],
      });
    }
    if (value.systolic !== undefined && value.diastolic !== undefined && value.systolic <= value.diastolic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Systolic pressure must be higher than diastolic pressure",
        path: ["systolic"],
      });
    }
  });

export const updatePatientVitalSchema = createPatientVitalSchema
  .innerType()
  .omit({ patientId: true })
  .partial();

export type ListPatientVitalsQuery = z.infer<typeof listPatientVitalsQuerySchema>;
export type CreatePatientVitalInput = z.infer<typeof createPatientVitalSchema>;
export type UpdatePatientVitalInput = z.infer<typeof updatePatientVitalSchema>;
