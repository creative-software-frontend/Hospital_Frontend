import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success, list } from "../../utils/apiResponse";
import * as settingService from "./setting.service";
import * as backupService from "./backup.service";

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

export const listIntegrations = asyncHandler(async (req: Request, res: Response) => {
  const integrations = await settingService.listIntegrations(req.user!);
  success(res, { integrations });
});

export const createIntegration = asyncHandler(async (req: Request, res: Response) => {
  const integration = await settingService.createIntegration(req.user!, req.body);
  success(res, { integration });
});

export const updateIntegration = asyncHandler(async (req: Request, res: Response) => {
  const integration = await settingService.updateIntegration(
    req.user!,
    Number(req.params.id),
    req.body,
  );
  success(res, { integration });
});

export const deleteIntegration = asyncHandler(async (req: Request, res: Response) => {
  await settingService.deleteIntegration(req.user!, Number(req.params.id));
  success(res, { message: "Integration deleted successfully" });
});

export const testIntegration = asyncHandler(async (req: Request, res: Response) => {
  const result = await settingService.testIntegration(req.user!, Number(req.params.id));
  success(res, { result });
});

export const getBackupOverview = asyncHandler(async (_req: Request, res: Response) => {
  const overview = await backupService.getBackupOverview();
  success(res, overview);
});

export const updateBackupSetting = asyncHandler(async (req: Request, res: Response) => {
  const backupSetting = await backupService.updateBackupSetting(req.user!, req.body);
  success(res, { backupSetting });
});

export const listBackupLogs = asyncHandler(async (req: Request, res: Response) => {
  const backups = await backupService.listBackupLogs(req.user!);
  success(res, { backups });
});

export const runBackup = asyncHandler(async (req: Request, res: Response) => {
  const backup = await backupService.runBackup(req.user!);
  success(res, { backup });
});

export const downloadBackupLog = asyncHandler(async (req: Request, res: Response) => {
  const { fileName, filePath, fileSize } = await backupService.resolveBackupFile(
    Number(req.params.id),
  );
  res.setHeader("Content-Type", "application/sql");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileName}"`,
  );
  res.setHeader("Content-Length", String(fileSize));
  res.download(filePath, fileName);
});

export const deleteBackupLog = asyncHandler(async (req: Request, res: Response) => {
  await backupService.deleteBackupLog(req.user!, Number(req.params.id));
  success(res, { message: "Backup log deleted successfully" });
});

export const clearBackupLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await backupService.clearBackupLogs(req.user!);
  success(res, { message: "All backup logs deleted", ...result });
});

export const listReportSettings = asyncHandler(async (req: Request, res: Response) => {
  const reports = await settingService.listReportSettings(req.user!);
  success(res, { reports });
});

export const createReportSetting = asyncHandler(async (req: Request, res: Response) => {
  const report = await settingService.createReportSetting(req.user!, req.body);
  success(res, { report });
});

export const updateReportSetting = asyncHandler(async (req: Request, res: Response) => {
  const report = await settingService.updateReportSetting(
    req.user!,
    Number(req.params.id),
    req.body,
  );
  success(res, { report });
});

export const deleteReportSetting = asyncHandler(async (req: Request, res: Response) => {
  await settingService.deleteReportSetting(req.user!, Number(req.params.id));
  success(res, { message: "Report setting deleted successfully" });
});

export const listMasterData = asyncHandler(async (req: Request, res: Response) => {
  const items = await settingService.listMasterData(
    req.user!,
    typeof req.query.category === "string" ? req.query.category : undefined,
  );
  success(res, { items });
});

export const listMasterDataOptions = asyncHandler(async (req: Request, res: Response) => {
  const options = await settingService.listMasterDataOptions(req.user!, req.params.category);
  success(res, { category: req.params.category, options });
});

export const listAddressDivisions = asyncHandler(async (req: Request, res: Response) => {
  const items = await settingService.listDivisions(req.user!);
  success(res, { items });
});

export const listAddressDistricts = asyncHandler(async (req: Request, res: Response) => {
  const items = await settingService.listDistricts(
    req.user!,
    typeof req.query.division === "string" ? req.query.division : undefined,
  );
  success(res, { items });
});

export const listAddressLocalities = asyncHandler(async (req: Request, res: Response) => {
  const items = await settingService.listLocalities(
    req.user!,
    typeof req.query.district === "string" ? req.query.district : undefined,
  );
  success(res, { items });
});

export const createMasterData = asyncHandler(async (req: Request, res: Response) => {
  const item = await settingService.createMasterData(req.user!, req.body);
  success(res, { item });
});

export const updateMasterData = asyncHandler(async (req: Request, res: Response) => {
  const item = await settingService.updateMasterData(req.user!, Number(req.params.id), req.body);
  success(res, { item });
});

export const deleteMasterData = asyncHandler(async (req: Request, res: Response) => {
  await settingService.deleteMasterData(req.user!, Number(req.params.id));
  success(res, { message: "Master data item deleted successfully" });
});

export const getLocalizationSetting = asyncHandler(async (req: Request, res: Response) => {
  const localization = await settingService.getLocalizationSetting(req.user!);
  success(res, { localization });
});

export const updateLocalizationSetting = asyncHandler(async (req: Request, res: Response) => {
  const localization = await settingService.updateLocalizationSetting(req.user!, req.body);
  success(res, { localization });
});

export const getSystemMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const maintenance = await settingService.getSystemMaintenance(req.user!);
  success(res, { maintenance });
});

export const updateSystemMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const maintenance = await settingService.updateSystemMaintenance(req.user!, req.body);
  success(res, { maintenance });
});

export const clearSystemCache = asyncHandler(async (req: Request, res: Response) => {
  const maintenance = await settingService.clearSystemCache(req.user!);
  success(res, { maintenance });
});

export const optimizeDatabase = asyncHandler(async (req: Request, res: Response) => {
  const maintenance = await settingService.optimizeDatabase(req.user!);
  success(res, { maintenance });
});