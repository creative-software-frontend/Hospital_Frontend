import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as ctrl from "./doctor-attendance.controller";
import {
  bulkDoctorAttendanceSchema,
  createDoctorAttendanceSchema,
  doctorAttendanceIdParamSchema,
  listDoctorAttendancesQuerySchema,
  updateDoctorAttendanceSchema,
} from "./doctor-attendance.validation";

const router = Router();
router.use(requireAuth);

router.get("/for-date", requirePermission("doctor", "read"), ctrl.getAttendanceForDate);
router.post("/bulk", validate({ body: bulkDoctorAttendanceSchema }), requirePermission("doctor", "update"), ctrl.bulkDoctorAttendance);

router.get("/", validate({ query: listDoctorAttendancesQuerySchema }), requirePermission("doctor", "read"), ctrl.listDoctorAttendances);
router.get("/:id", validate({ params: doctorAttendanceIdParamSchema }), requirePermission("doctor", "read"), ctrl.getDoctorAttendance);
router.post("/", validate({ body: createDoctorAttendanceSchema }), requirePermission("doctor", "create"), ctrl.createDoctorAttendance);
router.patch("/:id", validate({ params: doctorAttendanceIdParamSchema, body: updateDoctorAttendanceSchema }), requirePermission("doctor", "update"), ctrl.updateDoctorAttendance);
router.delete("/:id", validate({ params: doctorAttendanceIdParamSchema }), requirePermission("doctor", "update"), ctrl.deleteDoctorAttendance);

export default router;
