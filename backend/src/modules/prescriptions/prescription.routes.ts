import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validation.middleware";
import * as controller from "./prescription.controller";
import {
  createPrescriptionSchema,
  listPrescriptionsQuerySchema,
  prescriptionIdParamSchema,
  updatePrescriptionSchema,
} from "./prescription.validation";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  validate({ query: listPrescriptionsQuerySchema }),
  requirePermission("prescription", "read"),
  controller.listPrescriptions,
);

router.get(
  "/:id",
  validate({ params: prescriptionIdParamSchema }),
  requirePermission("prescription", "read"),
  controller.getPrescription,
);

router.post(
  "/",
  validate({ body: createPrescriptionSchema }),
  requirePermission("prescription", "create"),
  controller.createPrescription,
);

router.patch(
  "/:id/cancel",
  validate({ params: prescriptionIdParamSchema }),
  requirePermission("prescription", "update"),
  controller.cancelPrescription,
);

router.patch(
  "/:id",
  validate({ params: prescriptionIdParamSchema, body: updatePrescriptionSchema }),
  requirePermission("prescription", "update"),
  controller.updatePrescription,
);

export default router;
