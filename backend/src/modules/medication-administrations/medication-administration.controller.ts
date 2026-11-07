import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./medication-administration.service";
import { created, success } from "../../utils/apiResponse";

export const listMedicationAdministrations = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listMedicationAdministrations(req.user!, req.validatedQuery as never);
  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
    summary: result.summary,
  });
});

export const listPrescribedMedications = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listPrescribedMedications(req.user!, req.validatedQuery as never);
  res.status(200).json({
    success: true,
    data: result.rows,
    patient: result.patient,
  });
});

export const getMedicationAdministration = asyncHandler(async (req: Request, res: Response) => {
  success(res, await service.getMedicationAdministration(req.user!, Number(req.params.id)));
});

export const createMedicationAdministration = asyncHandler(async (req: Request, res: Response) => {
  created(res, await service.createMedicationAdministration(req.user!, req.body));
});

export const updateMedicationAdministration = asyncHandler(async (req: Request, res: Response) => {
  success(res, await service.updateMedicationAdministration(req.user!, Number(req.params.id), req.body));
});

export const deleteMedicationAdministration = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteMedicationAdministration(req.user!, Number(req.params.id));
  success(res, { message: "Medication administration deleted" });
});
