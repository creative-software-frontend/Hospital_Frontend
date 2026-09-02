import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as settingController from "./setting.controller";
import {
  listSystemSettingsQuerySchema,
  updatePatientSettingSchema,
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

export default router;