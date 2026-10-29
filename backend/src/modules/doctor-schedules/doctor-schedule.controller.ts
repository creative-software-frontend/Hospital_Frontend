import type { Request, Response } from "express";
import * as doctorScheduleService from "./doctor-schedule.service";
import { success, list, created } from "../../utils/apiResponse";

export async function listDoctorSchedules(req: Request, res: Response) {
  const actor = req.user!;
  const result = await doctorScheduleService.listDoctorSchedules(actor, req.validatedQuery ?? req.query);
  return list(res, result.data, result.pagination);
}

export async function getDoctorSchedule(req: Request, res: Response) {
  const actor = req.user!;
  const id = Number(req.params.id);
  const row = await doctorScheduleService.getDoctorSchedule(actor, id);
  return success(res, row);
}

export async function createDoctorSchedule(req: Request, res: Response) {
  const actor = req.user!;
  const row = await doctorScheduleService.createDoctorSchedule(actor, req.body);
  return created(res, row);
}

export async function updateDoctorSchedule(req: Request, res: Response) {
  const actor = req.user!;
  const id = Number(req.params.id);
  const row = await doctorScheduleService.updateDoctorSchedule(actor, id, req.body);
  return success(res, row);
}

export async function deleteDoctorSchedule(req: Request, res: Response) {
  const actor = req.user!;
  const id = Number(req.params.id);
  await doctorScheduleService.deleteDoctorSchedule(actor, id);
  return success(res, { message: "Doctor schedule deleted" });
}

export async function getDoctorScheduleByDoctor(req: Request, res: Response) {
  const actor = req.user!;
  const doctorId = Number(req.params.doctorId);
  const rows = await doctorScheduleService.getDoctorScheduleByDoctor(actor, doctorId);
  return success(res, rows);
}

export async function replaceDoctorSchedule(req: Request, res: Response) {
  const actor = req.user!;
  const doctorId = Number(req.params.doctorId);
  const rows = await doctorScheduleService.replaceDoctorSchedule(actor, doctorId, req.body);
  return success(res, rows);
}
