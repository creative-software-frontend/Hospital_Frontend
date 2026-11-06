import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validation.middleware";
import * as controller from "./patient-vital.controller";
import {
  createPatientVitalSchema,
  listPatientVitalsQuerySchema,
  patientVitalIdParamSchema,
  updatePatientVitalSchema,
} from "./patient-vital.validation";

const router = Router();
router.use(requireAuth);

// Patient Monitoring reuses the nursing-note permissions (same nursing staff).
router.get(
  "/",
  validate({ query: listPatientVitalsQuerySchema }),
  requirePermission("nursingNote", "read"),
  controller.listPatientVitals,
);
router.get(
  "/:id",
  validate({ params: patientVitalIdParamSchema }),
  requirePermission("nursingNote", "read"),
  controller.getPatientVital,
);
router.post(
  "/",
  validate({ body: createPatientVitalSchema }),
  requirePermission("nursingNote", "create"),
  controller.createPatientVital,
);
router.patch(
  "/:id",
  validate({ params: patientVitalIdParamSchema, body: updatePatientVitalSchema }),
  requirePermission("nursingNote", "update"),
  controller.updatePatientVital,
);
router.delete(
  "/:id",
  validate({ params: patientVitalIdParamSchema }),
  requirePermission("nursingNote", "update"),
  controller.deletePatientVital,
);

export default router;
