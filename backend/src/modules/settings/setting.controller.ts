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