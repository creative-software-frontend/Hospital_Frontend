import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Appointment / OPD visit
 * ------------------------------------------------------------------ */

export const createOpdAppointmentSchema = z.object({
  patientId: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  appointmentDate: z.string().datetime({ offset: true }).or(z.string().date()),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  reason: z.string().optional(),
  notes: z.string().optional(),
  visitType: z.enum(["OPD", "FOLLOWUP"]).default("OPD"),
});

export type CreateOpdAppointmentInput = z.infer<typeof createOpdAppointmentSchema>;

export const updateOpdAppointmentSchema = z.object({
  status: z
    .enum(["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
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
