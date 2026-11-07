import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validation.middleware";
import * as controller from "./medication-administration.controller";
import {
  createMedicationAdministrationSchema,
  listMedicationAdministrationsQuerySchema,
  listPrescribedMedicationsQuerySchema,
  medicationAdministrationIdParamSchema,
  updateMedicationAdministrationSchema,
} from "./medication-administration.validation";

const router = Router();
router.use(requireAuth);

// Medication Tracking reuses the nursing-note permissions (same nursing staff).
router.get(
  "/",
  validate({ query: listMedicationAdministrationsQuerySchema }),
  requirePermission("nursingNote", "read"),
  controller.listMedicationAdministrations,
);
router.get(
  "/prescribed",
  validate({ query: listPrescribedMedicationsQuerySchema }),
  requirePermission("nursingNote", "read"),
  controller.listPrescribedMedications,
);
router.get(
  "/:id",
  validate({ params: medicationAdministrationIdParamSchema }),
  requirePermission("nursingNote", "read"),
  controller.getMedicationAdministration,
);
router.post(
  "/",
  validate({ body: createMedicationAdministrationSchema }),
  requirePermission("nursingNote", "create"),
  controller.createMedicationAdministration,
);
router.patch(
  "/:id",
  validate({ params: medicationAdministrationIdParamSchema, body: updateMedicationAdministrationSchema }),
  requirePermission("nursingNote", "update"),
  controller.updateMedicationAdministration,
);
router.delete(
  "/:id",
  validate({ params: medicationAdministrationIdParamSchema }),
  requirePermission("nursingNote", "update"),
  controller.deleteMedicationAdministration,
);

export default router;
