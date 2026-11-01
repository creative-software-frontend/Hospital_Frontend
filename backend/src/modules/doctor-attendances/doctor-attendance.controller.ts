import { Request, Response } from "express";
import * as svc from "./doctor-attendance.service";
import { success, list, created } from "../../utils/apiResponse";

export async function listDoctorAttendances(req: Request, res: Response) {
  const actor = req.user!;
  const result = await svc.listDoctorAttendances(actor, req.query as never);
  return list(res, result.data, result.pagination);
}

export async function getDoctorAttendance(req: Request, res: Response) {
  const actor = req.user!;
  const row = await svc.getDoctorAttendance(actor, Number(req.params.id));
  return success(res, row);
}

export async function createDoctorAttendance(req: Request, res: Response) {
  const actor = req.user!;
  const row = await svc.createDoctorAttendance(actor, req.body);
  return created(res, row);
}

export async function updateDoctorAttendance(req: Request, res: Response) {
  const actor = req.user!;
  const row = await svc.updateDoctorAttendance(actor, Number(req.params.id), req.body);
  return success(res, row);
}

export async function deleteDoctorAttendance(req: Request, res: Response) {
  const actor = req.user!;
  await svc.deleteDoctorAttendance(actor, Number(req.params.id));
  return success(res, { message: "Attendance deleted" });
}

export async function bulkDoctorAttendance(req: Request, res: Response) {
  const actor = req.user!;
  const rows = await svc.bulkDoctorAttendance(actor, req.body);
  return success(res, rows);
}

export async function getAttendanceForDate(req: Request, res: Response) {
  const actor = req.user!;
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  const rows = await svc.getAttendanceForDate(actor, date);
  return success(res, rows);
}
