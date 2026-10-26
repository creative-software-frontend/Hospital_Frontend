import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Appointment / OPD visit
 * ------------------------------------------------------------------ */

export const createOpdAppointmentSchema = z.object({
  patientId: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  appointmentDate: z.string().datetime({ offset: true }).or(z.string().date()),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid start time"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid end time"),
  doctorFee: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid doctor fee").optional().nullable(),
  shift: z.string().trim().max(100).optional().nullable(),
  appointmentPriority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  discountPercentage: z.string().regex(/^(100|[0-9]{1,2})(\.\d{1,2})?$/, "Invalid discount percentage").optional().nullable(),
  liveConsultant: z.boolean().default(false),
  paymentMode: z.string().trim().max(100).optional().nullable(),
  message: z.string().trim().max(191).optional().nullable(),
  alternateAddress: z.string().trim().max(191).optional().nullable(),
  reason: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  visitType: z.enum(["OPD", "FOLLOWUP"]).default("OPD"),
}).superRefine((input, ctx) => {
  if (input.endTime <= input.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "End time must be after start time",
    });
  }

  const appointmentDate = new Date(input.appointmentDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  appointmentDate.setHours(0, 0, 0, 0);
  if (appointmentDate < today) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["appointmentDate"],
      message: "Appointment date cannot be in the past",
    });
  }
});

export type CreateOpdAppointmentInput = z.infer<typeof createOpdAppointmentSchema>;

export const updateOpdAppointmentSchema = z.object({
  status: z
    .enum(["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .optional(),
  reason: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type UpdateOpdAppointmentInput = z.infer<typeof updateOpdAppointmentSchema>;

export const createOpdVisitSchema = z.object({
  patientId: z.number().int().positive(),
  doctorId: z.number().int().positive().optional(),
  appointmentId: z.number().int().positive().optional(),
  visitType: z.enum(["OPD", "FOLLOWUP"]).default("OPD"),
  chiefComplaint: z.string().optional(),
  history: z.string().optional(),
  examination: z.string().optional(),
  notes: z.string().optional(),
  vitals: z.record(z.unknown()).optional(),
  /**
   * Override the configured registrationFee. Only allowed if the caller has
   * billing:update permission; the service enforces this separately.
   */
  registrationFeeOverride: z.instanceof(Object).optional(),
  consultationFeeOverride: z.instanceof(Object).optional(),
});

export type CreateOpdVisitInput = z.infer<typeof createOpdVisitSchema>;

export const listOpdAppointmentsQuerySchema = z.object({
  date: z.string().date().optional(),
  doctorId: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .optional(),
  patientId: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .optional(),
  status: z
    .enum(["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default("20"),
});

export type ListOpdAppointmentsQuery = z.infer<typeof listOpdAppointmentsQuerySchema>;
