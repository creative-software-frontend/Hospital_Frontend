import { z } from "zod";

export const ATTENDANCE_STATUS_VALUES = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE"] as const;

const optionalTime = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Time must be HH:MM")
  .optional()
  .nullable();

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => undefined));

export const employeeAttendanceIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid attendance id"),
});

export const listEmployeeAttendancesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  date: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  status: z.enum(ATTENDANCE_STATUS_VALUES).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createEmployeeAttendanceSchema = z.object({
  employeeId: z.coerce.number().int().positive("employeeId is required"),
  date: z.string().trim().min(1, "date is required"),
  status: z.enum(ATTENDANCE_STATUS_VALUES).optional(),
  checkInTime: optionalTime,
  checkOutTime: optionalTime,
  notes: optionalString(500),
});

export const updateEmployeeAttendanceSchema = z.object({
  status: z.enum(ATTENDANCE_STATUS_VALUES).optional(),
  checkInTime: optionalTime,
  checkOutTime: optionalTime,
  notes: optionalString(500),
});

export const bulkEmployeeAttendanceSchema = z.object({
  date: z.string().trim().min(1, "date is required"),
  entries: z.array(
    z.object({
      employeeId: z.coerce.number().int().positive(),
      status: z.enum(ATTENDANCE_STATUS_VALUES),
      checkInTime: optionalTime,
      checkOutTime: optionalTime,
      notes: optionalString(500),
    }),
  ),
});

export type ListEmployeeAttendancesQuery = z.infer<typeof listEmployeeAttendancesQuerySchema>;
export type CreateEmployeeAttendanceInput = z.infer<typeof createEmployeeAttendanceSchema>;
export type UpdateEmployeeAttendanceInput = z.infer<typeof updateEmployeeAttendanceSchema>;
export type BulkEmployeeAttendanceInput = z.infer<typeof bulkEmployeeAttendanceSchema>;
