import { z } from "zod";

export const SCHEDULE_STATUS_VALUES = ["active", "inactive"] as const;

const timeString = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Time must be HH:MM")
  .optional()
  .nullable();

export const doctorScheduleIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid schedule id"),
});

export const doctorIdParamSchema = z.object({
  doctorId: z.coerce.number().int().positive("Invalid doctor id"),
});

export const listDoctorSchedulesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  doctorId: z.coerce.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createDoctorScheduleSchema = z.object({
  doctorId: z.coerce.number().int().positive("doctorId is required"),
  dayOfWeek: z.number().int().min(0).max(6, "dayOfWeek must be 0-6"),
  startTime: timeString,
  endTime: timeString,
  roomId: z.coerce.number().int().positive().optional().nullable(),
  appointmentLimit: z.coerce.number().int().min(0).optional(),
  status: z.enum(SCHEDULE_STATUS_VALUES).optional(),
});

export const updateDoctorScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: timeString,
  endTime: timeString,
  roomId: z.coerce.number().int().positive().optional().nullable(),
  appointmentLimit: z.coerce.number().int().min(0).optional(),
  status: z.enum(SCHEDULE_STATUS_VALUES).optional(),
});

export const replaceDoctorScheduleSchema = z.object({
  slots: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: timeString,
        endTime: timeString,
        roomId: z.coerce.number().int().positive().optional().nullable(),
        appointmentLimit: z.coerce.number().int().min(0).optional(),
        status: z.enum(SCHEDULE_STATUS_VALUES).optional(),
      }),
    )
    .max(7, "At most 7 days"),
});

export type ListDoctorSchedulesQuery = z.infer<typeof listDoctorSchedulesQuerySchema>;
export type CreateDoctorScheduleInput = z.infer<typeof createDoctorScheduleSchema>;
export type UpdateDoctorScheduleInput = z.infer<typeof updateDoctorScheduleSchema>;
export type ReplaceDoctorScheduleInput = z.infer<typeof replaceDoctorScheduleSchema>;
