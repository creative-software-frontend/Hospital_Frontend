import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success, list } from "../../utils/apiResponse";
import * as settingService from "./setting.service";

export const listSystemSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingService.listSystemSettings(req.user!, req.query as never);
  success(res, { settings });
});

export const upsertSystemSetting = asyncHandler(async (req: Request, res: Response) => {
  const setting = await settingService.upsertSystemSetting(req.user!, req.body);
  success(res, { setting });
});

export const deleteSystemSetting = asyncHandler(async (req: Request, res: Response) => {
  await settingService.deleteSystemSetting(req.user!, Number(req.params.id));
  success(res, { message: "System setting deleted successfully" });
});

export const getSecuritySetting = asyncHandler(async (_req: Request, res: Response) => {
  const security = await settingService.getSecuritySetting();
  success(res, { security });
});

export const updateSecuritySetting = asyncHandler(async (req: Request, res: Response) => {
  const security = await settingService.updateSecuritySetting(req.user!, req.body);
  success(res, { security });
});

export const getPatientSetting = asyncHandler(async (req: Request, res: Response) => {
  const patientSetting = await settingService.getPatientSetting(req.user!);
  success(res, { patientSetting });
});

export const updatePatientSetting = asyncHandler(async (req: Request, res: Response) => {
  const patientSetting = await settingService.updatePatientSetting(req.user!, req.body);
  success(res, { patientSetting });
});

export const getOpdSetting = asyncHandler(async (req: Request, res: Response) => {
  const opdSetting = await settingService.getOpdSetting(req.user!);
  success(res, { opdSetting });
});

export const updateOpdSetting = asyncHandler(async (req: Request, res: Response) => {
  const opdSetting = await settingService.updateOpdSetting(req.user!, req.body);
  success(res, { opdSetting });
});

export const getIpdSetting = asyncHandler(async (req: Request, res: Response) => {
  const ipdSetting = await settingService.getIpdSetting(req.user!);
  success(res, { ipdSetting });
});

export const updateIpdSetting = asyncHandler(async (req: Request, res: Response) => {
  const ipdSetting = await settingService.updateIpdSetting(req.user!, req.body);
  success(res, { ipdSetting });
});

export const getEmergencySetting = asyncHandler(async (req: Request, res: Response) => {
  const emergencySetting = await settingService.getEmergencySetting(req.user!);
  success(res, { emergencySetting });
});

export const updateEmergencySetting = asyncHandler(async (req: Request, res: Response) => {
  const emergencySetting = await settingService.updateEmergencySetting(req.user!, req.body);
  success(res, { emergencySetting });
});

export const getPrescriptionSetting = asyncHandler(async (req: Request, res: Response) => {
  const prescriptionSetting = await settingService.getPrescriptionSetting(req.user!);
  success(res, { prescriptionSetting });
});

export const updatePrescriptionSetting = asyncHandler(async (req: Request, res: Response) => {
  const prescriptionSetting = await settingService.updatePrescriptionSetting(req.user!, req.body);
  success(res, { prescriptionSetting });
});