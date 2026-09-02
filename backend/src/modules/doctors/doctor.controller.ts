import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success, created, list } from "../../utils/apiResponse";
import * as doctorService from "./doctor.service";

export const listDoctors = asyncHandler(async (req: Request, res: Response) => {
  const result = await doctorService.listDoctors(req.user!, req.query as never);
  list(res, result.data, result.pagination);
});

export const getDoctor = asyncHandler(async (req: Request, res: Response) => {
  const doctor = await doctorService.getDoctor(req.user!, Number(req.params.id));
  success(res, { doctor });
});

export const createDoctor = asyncHandler(async (req: Request, res: Response) => {
  const doctor = await doctorService.createDoctor(req.user!, req.body);
  created(res, { doctor });
});

export const updateDoctor = asyncHandler(async (req: Request, res: Response) => {
  const doctor = await doctorService.updateDoctor(req.user!, Number(req.params.id), req.body);
  success(res, { doctor });
});