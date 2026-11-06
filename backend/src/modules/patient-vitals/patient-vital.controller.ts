import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./patient-vital.service";
import { created, success } from "../../utils/apiResponse";

export const listPatientVitals = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listPatientVitals(req.user!, req.validatedQuery as never);
  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
    summary: result.summary,
  });
});

export const getPatientVital = asyncHandler(async (req: Request, res: Response) => {
  success(res, await service.getPatientVital(req.user!, Number(req.params.id)));
});

export const createPatientVital = asyncHandler(async (req: Request, res: Response) => {
  created(res, await service.createPatientVital(req.user!, req.body));
});

export const updatePatientVital = asyncHandler(async (req: Request, res: Response) => {
  success(res, await service.updatePatientVital(req.user!, Number(req.params.id), req.body));
});

export const deletePatientVital = asyncHandler(async (req: Request, res: Response) => {
  await service.deletePatientVital(req.user!, Number(req.params.id));
  success(res, { message: "Vitals record deleted" });
});
