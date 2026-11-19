import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./employee-attendance.service";
import {
  createEmployeeAttendanceSchema,
  employeeAttendanceIdParamSchema,
  listEmployeeAttendancesQuerySchema,
  updateEmployeeAttendanceSchema,
  bulkEmployeeAttendanceSchema,
} from "./employee-attendance.validation";

export const listEmployeeAttendances = asyncHandler(async (req: Request, res: Response) => {
  const query = listEmployeeAttendancesQuerySchema.parse(req.query);
  const result = await service.listEmployeeAttendances(req.user!, query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const getEmployeeAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = employeeAttendanceIdParamSchema.parse(req.params);
  const result = await service.getEmployeeAttendance(req.user!, id);
  res.json({ success: true, data: result });
});

export const createEmployeeAttendance = asyncHandler(async (req: Request, res: Response) => {
  const input = createEmployeeAttendanceSchema.parse(req.body);
  const result = await service.createEmployeeAttendance(req.user!, input);
  res.status(201).json({ success: true, data: result });
});

export const updateEmployeeAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = employeeAttendanceIdParamSchema.parse(req.params);
  const input = updateEmployeeAttendanceSchema.parse(req.body);
  const result = await service.updateEmployeeAttendance(req.user!, id, input);
  res.json({ success: true, data: result });
});

export const deleteEmployeeAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = employeeAttendanceIdParamSchema.parse(req.params);
  await service.deleteEmployeeAttendance(req.user!, id);
  res.json({ success: true, message: "Deleted" });
});

export const bulkEmployeeAttendance = asyncHandler(async (req: Request, res: Response) => {
  const input = bulkEmployeeAttendanceSchema.parse(req.body);
  const result = await service.bulkEmployeeAttendance(req.user!, input);
  res.json({ success: true, data: result });
});

export const getEmployeeAttendanceForDate = asyncHandler(async (req: Request, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const result = await service.getEmployeeAttendanceForDate(req.user!, date);
  res.json({ success: true, data: result });
});
