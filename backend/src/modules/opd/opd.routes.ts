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

// Permissions are seeded under the `appointment` module (see prisma/seed.ts
// PERMISSIONS/MATRIX); the historical `requirePermission("opd", ...)` matched
// nothing in the Permission table and 403'd every route below.

// Fee configuration — used by the frontend to display configured fees
router.get(
  "/fee-config",
  requirePermission("appointment", "read"),
  opdController.getOpdFeeConfig,
);

// Appointments
router.get(
  "/appointments",
  validate({ query: listOpdAppointmentsQuerySchema }),
  requirePermission("appointment", "read"),
  opdController.listOpdAppointments,
);

router.post(
  "/appointments",
  validate({ body: createOpdAppointmentSchema }),
  requirePermission("appointment", "create"),
  opdController.createOpdAppointment,
);

router.patch(
  "/appointments/:id",
  validate({ body: updateOpdAppointmentSchema }),
  requirePermission("appointment", "update"),
  opdController.updateOpdAppointmentStatus,
);

// OPD Visit (with settings-driven fee application)
router.post(
  "/visits",
  validate({ body: createOpdVisitSchema }),
  requirePermission("appointment", "create"),
  opdController.createOpdVisit,
);

export default router;
