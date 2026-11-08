import type { Request, Response } from "express";
import * as doctorScheduleService from "./doctor-schedule.service";
import { success, list, created } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const listDoctorSchedules = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const result = await doctorScheduleService.listDoctorSchedules(actor, req.validatedQuery ?? req.query);
  list(res, result.data, result.pagination);
});

export const getDoctorSchedule = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const id = Number(req.params.id);
  const row = await doctorScheduleService.getDoctorSchedule(actor, id);
  success(res, row);
});

export const createDoctorSchedule = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const row = await doctorScheduleService.createDoctorSchedule(actor, req.body);
  created(res, row);
});

export const updateDoctorSchedule = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const id = Number(req.params.id);
  const row = await doctorScheduleService.updateDoctorSchedule(actor, id, req.body);
  success(res, row);
});

export const deleteDoctorSchedule = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const id = Number(req.params.id);
  await doctorScheduleService.deleteDoctorSchedule(actor, id);
  success(res, { message: "Doctor schedule deleted" });
});

export const getDoctorScheduleByDoctor = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const doctorId = Number(req.params.doctorId);
  const rows = await doctorScheduleService.getDoctorScheduleByDoctor(actor, doctorId);
  success(res, rows);
});

export const replaceDoctorSchedule = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const doctorId = Number(req.params.doctorId);
  const rows = await doctorScheduleService.replaceDoctorSchedule(actor, doctorId, req.body);
  success(res, rows);
});
