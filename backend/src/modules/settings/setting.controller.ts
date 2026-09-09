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

export const getPharmacySetting = asyncHandler(async (req: Request, res: Response) => {
  const pharmacySetting = await settingService.getPharmacySetting(req.user!);
  success(res, { pharmacySetting });
});

export const updatePharmacySetting = asyncHandler(async (req: Request, res: Response) => {
  const pharmacySetting = await settingService.updatePharmacySetting(req.user!, req.body);
  success(res, { pharmacySetting });
});

export const getLabSetting = asyncHandler(async (req: Request, res: Response) => {
  const labSetting = await settingService.getLabSetting(req.user!);
  success(res, { labSetting });
});

export const updateLabSetting = asyncHandler(async (req: Request, res: Response) => {
  const labSetting = await settingService.updateLabSetting(req.user!, req.body);
  success(res, { labSetting });
});

export const getBillingSetting = asyncHandler(async (req: Request, res: Response) => {
  const billingSetting = await settingService.getBillingSetting(req.user!);
  success(res, { billingSetting });
});

export const updateBillingSetting = asyncHandler(async (req: Request, res: Response) => {
  const billingSetting = await settingService.updateBillingSetting(req.user!, req.body);
  success(res, { billingSetting });
});

export const getAccountingSetting = asyncHandler(async (req: Request, res: Response) => {
  const accountingSetting = await settingService.getAccountingSetting(req.user!);
  success(res, { accountingSetting });
});

export const updateAccountingSetting = asyncHandler(async (req: Request, res: Response) => {
  const accountingSetting = await settingService.updateAccountingSetting(req.user!, req.body);
  success(res, { accountingSetting });
});

export const getHrSetting = asyncHandler(async (req: Request, res: Response) => {
  const hrSetting = await settingService.getHrSetting(req.user!);
  success(res, { hrSetting });
});

export const updateHrSetting = asyncHandler(async (req: Request, res: Response) => {
  const hrSetting = await settingService.updateHrSetting(req.user!, req.body);
  success(res, { hrSetting });
});

export const getInventorySetting = asyncHandler(async (req: Request, res: Response) => {
  const inventorySetting = await settingService.getInventorySetting(req.user!);
  success(res, { inventorySetting });
});

export const updateInventorySetting = asyncHandler(async (req: Request, res: Response) => {
  const inventorySetting = await settingService.updateInventorySetting(req.user!, req.body);
  success(res, { inventorySetting });
});

export const getNotificationSetting = asyncHandler(async (req: Request, res: Response) => {
  const notificationSetting = await settingService.getNotificationSetting(req.user!);
  success(res, { notificationSetting });
});

export const updateNotificationSetting = asyncHandler(async (req: Request, res: Response) => {
  const notificationSetting = await settingService.updateNotificationSetting(req.user!, req.body);
  success(res, { notificationSetting });
});

export const listPrintTemplates = asyncHandler(async (req: Request, res: Response) => {
  const templates = await settingService.listPrintTemplates(req.user!);
  success(res, { templates });
});

export const createPrintTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await settingService.createPrintTemplate(req.user!, req.body);
  success(res, { template });
});

export const updatePrintTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await settingService.updatePrintTemplate(
    req.user!,
    Number(req.params.id),
    req.body,
  );
  success(res, { template });
});

export const deletePrintTemplate = asyncHandler(async (req: Request, res: Response) => {
  await settingService.deletePrintTemplate(req.user!, Number(req.params.id));
  success(res, { message: "Print template deleted successfully" });
});