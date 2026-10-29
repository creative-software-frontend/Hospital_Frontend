import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as ctrl from "./doctor-schedule.controller";
import {
  createDoctorScheduleSchema,
  doctorIdParamSchema,
  doctorScheduleIdParamSchema,
  listDoctorSchedulesQuerySchema,
  replaceDoctorScheduleSchema,
  updateDoctorScheduleSchema,
} from "./doctor-schedule.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/doctor/:doctorId",
  validate({ params: doctorIdParamSchema }),
  requirePermission("doctor", "read"),
  ctrl.getDoctorScheduleByDoctor,
);

router.put(
  "/doctor/:doctorId",
  validate({ params: doctorIdParamSchema, body: replaceDoctorScheduleSchema }),
  requirePermission("doctor", "update"),
  ctrl.replaceDoctorSchedule,
);

router.get(
  "/",
  validate({ query: listDoctorSchedulesQuerySchema }),
  requirePermission("doctor", "read"),
  ctrl.listDoctorSchedules,
);

router.get(
  "/:id",
  validate({ params: doctorScheduleIdParamSchema }),
  requirePermission("doctor", "read"),
  ctrl.getDoctorSchedule,
);

router.post(
  "/",
  validate({ body: createDoctorScheduleSchema }),
  requirePermission("doctor", "create"),
  ctrl.createDoctorSchedule,
);

router.patch(
  "/:id",
  validate({ params: doctorScheduleIdParamSchema, body: updateDoctorScheduleSchema }),
  requirePermission("doctor", "update"),
  ctrl.updateDoctorSchedule,
);

router.delete(
  "/:id",
  validate({ params: doctorScheduleIdParamSchema }),
  requirePermission("doctor", "update"),
  ctrl.deleteDoctorSchedule,
);

export default router;
