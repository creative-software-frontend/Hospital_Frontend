import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as settingController from "./setting.controller";
import {
  listSystemSettingsQuerySchema,
  updateEmergencySettingSchema,
  updateIpdSettingSchema,
  updateOpdSettingSchema,
  updatePatientSettingSchema,
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

export default router;