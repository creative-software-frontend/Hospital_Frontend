import { Request, Response } from "express";
import * as svc from "./doctor-attendance.service";
import { success, list, created } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const listDoctorAttendances = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const result = await svc.listDoctorAttendances(actor, req.validatedQuery ?? req.query);
  list(res, result.data, result.pagination);
});

export const getDoctorAttendance = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const row = await svc.getDoctorAttendance(actor, Number(req.params.id));
  success(res, row);
});

export const createDoctorAttendance = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const row = await svc.createDoctorAttendance(actor, req.body);
  created(res, row);
});

export const updateDoctorAttendance = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const row = await svc.updateDoctorAttendance(actor, Number(req.params.id), req.body);
  success(res, row);
});

export const deleteDoctorAttendance = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  await svc.deleteDoctorAttendance(actor, Number(req.params.id));
  success(res, { message: "Attendance deleted" });
});

export const bulkDoctorAttendance = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const rows = await svc.bulkDoctorAttendance(actor, req.body);
  success(res, rows);
});

export const getAttendanceForDate = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  const rows = await svc.getAttendanceForDate(actor, date);
  success(res, rows);
});
