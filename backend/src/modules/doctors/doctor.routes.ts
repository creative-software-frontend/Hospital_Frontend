import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as doctorController from "./doctor.controller";
import {
  createDoctorSchema,
  doctorIdParamSchema,
  listDoctorsQuerySchema,
  updateDoctorSchema,
} from "./doctor.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate({ query: listDoctorsQuerySchema }),
  requirePermission("doctor", "read"),
  doctorController.listDoctors,
);

router.get(
  "/:id",
  validate({ params: doctorIdParamSchema }),
  requirePermission("doctor", "read"),
  doctorController.getDoctor,
);

router.post(
  "/",
  validate({ body: createDoctorSchema }),
  requirePermission("doctor", "create"),
  doctorController.createDoctor,
);

router.patch(
  "/:id",
  validate({ params: doctorIdParamSchema, body: updateDoctorSchema }),
  requirePermission("doctor", "update"),
  doctorController.updateDoctor,
);

export default router;