import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as opdController from "./opd.controller";
import {
  createOpdAppointmentSchema,
  updateOpdAppointmentSchema,
  createOpdVisitSchema,
  listOpdAppointmentsQuerySchema,
} from "./opd.validation";

const router = Router();
router.use(requireAuth);

// Fee configuration — used by the frontend to display configured fees
router.get(
  "/fee-config",
  requirePermission("opd", "read"),
  opdController.getOpdFeeConfig,
);

// Appointments
router.get(
  "/appointments",
  validate({ query: listOpdAppointmentsQuerySchema }),
  requirePermission("opd", "read"),
  opdController.listOpdAppointments,
);

router.post(
  "/appointments",
  validate({ body: createOpdAppointmentSchema }),
  requirePermission("opd", "create"),
  opdController.createOpdAppointment,
);

router.patch(
  "/appointments/:id",
  validate({ body: updateOpdAppointmentSchema }),
  requirePermission("opd", "update"),
  opdController.updateOpdAppointmentStatus,
);

// OPD Visit (with settings-driven fee application)
router.post(
  "/visits",
  validate({ body: createOpdVisitSchema }),
  requirePermission("opd", "create"),
  opdController.createOpdVisit,
);

export default router;
