import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as settingController from "./setting.controller";
import {
  listSystemSettingsQuerySchema,
  updateAccountingSettingSchema,
  updateBillingSettingSchema,
  updateEmergencySettingSchema,
  updateHrSettingSchema,
  updateIpdSettingSchema,
  updateLabSettingSchema,
  updateOpdSettingSchema,
  updatePatientSettingSchema,
  updatePharmacySettingSchema,
  updatePrescriptionSettingSchema,
  updateSecuritySettingSchema,
  upsertSystemSettingSchema,
} from "./setting.validation";

const router = Router();

router.use(requireAuth);

// System (general) settings
router.get(
  "/system",
  validate({ query: listSystemSettingsQuerySchema }),
  requirePermission("systemSetting", "read"),
  settingController.listSystemSettings,
);

router.post(
  "/system",
  validate({ body: upsertSystemSettingSchema }),
  requirePermission("systemSetting", "update"),
  settingController.upsertSystemSetting,
);

router.delete(
  "/system/:id",
  requirePermission("systemSetting", "update"),
  settingController.deleteSystemSetting,
);

// Security settings
router.get(
  "/security",
  requirePermission("securitySetting", "read"),
  settingController.getSecuritySetting,
);

router.patch(
  "/security",
  validate({ body: updateSecuritySettingSchema }),
  requirePermission("securitySetting", "update"),
  settingController.updateSecuritySetting,
);

// Patient configuration settings
router.get(
  "/patient",
  requirePermission("patientSetting", "read"),
  settingController.getPatientSetting,
);

router.patch(
  "/patient",
  validate({ body: updatePatientSettingSchema }),
  requirePermission("patientSetting", "update"),
  settingController.updatePatientSetting,
);

// OPD settings
router.get(
  "/opd",
  requirePermission("opdSetting", "read"),
  settingController.getOpdSetting,
);

router.patch(
  "/opd",
  validate({ body: updateOpdSettingSchema }),
  requirePermission("opdSetting", "update"),
  settingController.updateOpdSetting,
);

// IPD settings
router.get(
  "/ipd",
  requirePermission("ipdSetting", "read"),
  settingController.getIpdSetting,
);

router.patch(
  "/ipd",
  validate({ body: updateIpdSettingSchema }),
  requirePermission("ipdSetting", "update"),
  settingController.updateIpdSetting,
);

// Emergency settings
router.get(
  "/emergency",
  requirePermission("emergencySetting", "read"),
  settingController.getEmergencySetting,
);

router.patch(
  "/emergency",
  validate({ body: updateEmergencySettingSchema }),
  requirePermission("emergencySetting", "update"),
  settingController.updateEmergencySetting,
);

// Prescription settings
router.get(
  "/prescription",
  requirePermission("prescriptionSetting", "read"),
  settingController.getPrescriptionSetting,
);

router.patch(
  "/prescription",
  validate({ body: updatePrescriptionSettingSchema }),
  requirePermission("prescriptionSetting", "update"),
  settingController.updatePrescriptionSetting,
);

// Pharmacy settings
router.get(
  "/pharmacy",
  requirePermission("pharmacySetting", "read"),
  settingController.getPharmacySetting,
);

router.patch(
  "/pharmacy",
  validate({ body: updatePharmacySettingSchema }),
  requirePermission("pharmacySetting", "update"),
  settingController.updatePharmacySetting,
);

// Laboratory settings
router.get(
  "/lab",
  requirePermission("labSetting", "read"),
  settingController.getLabSetting,
);

router.patch(
  "/lab",
  validate({ body: updateLabSettingSchema }),
  requirePermission("labSetting", "update"),
  settingController.updateLabSetting,
);

// Billing settings
router.get(
  "/billing",
  requirePermission("billingSetting", "read"),
  settingController.getBillingSetting,
);

router.patch(
  "/billing",
  validate({ body: updateBillingSettingSchema }),
  requirePermission("billingSetting", "update"),
  settingController.updateBillingSetting,
);

// Accounting settings
router.get(
  "/accounting",
  requirePermission("accountingSetting", "read"),
  settingController.getAccountingSetting,
);

router.patch(
  "/accounting",
  validate({ body: updateAccountingSettingSchema }),
  requirePermission("accountingSetting", "update"),
  settingController.updateAccountingSetting,
);

// HR & Payroll settings
router.get(
  "/hr",
  requirePermission("hrSetting", "read"),
  settingController.getHrSetting,
);

router.patch(
  "/hr",
  validate({ body: updateHrSettingSchema }),
  requirePermission("hrSetting", "update"),
  settingController.updateHrSetting,
);

export default router;