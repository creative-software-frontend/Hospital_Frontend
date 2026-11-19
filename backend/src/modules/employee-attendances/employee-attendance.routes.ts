import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as ctrl from "./employee-attendance.controller";
import {
  bulkEmployeeAttendanceSchema,
  createEmployeeAttendanceSchema,
  employeeAttendanceIdParamSchema,
  listEmployeeAttendancesQuerySchema,
  updateEmployeeAttendanceSchema,
} from "./employee-attendance.validation";

const router = Router();
router.use(requireAuth);

router.get("/for-date", requirePermission("employee", "read"), ctrl.getEmployeeAttendanceForDate);
router.post("/bulk", validate({ body: bulkEmployeeAttendanceSchema }), requirePermission("employee", "update"), ctrl.bulkEmployeeAttendance);

router.get("/", validate({ query: listEmployeeAttendancesQuerySchema }), requirePermission("employee", "read"), ctrl.listEmployeeAttendances);
router.get("/:id", validate({ params: employeeAttendanceIdParamSchema }), requirePermission("employee", "read"), ctrl.getEmployeeAttendance);
router.post("/", validate({ body: createEmployeeAttendanceSchema }), requirePermission("employee", "create"), ctrl.createEmployeeAttendance);
router.patch("/:id", validate({ params: employeeAttendanceIdParamSchema, body: updateEmployeeAttendanceSchema }), requirePermission("employee", "update"), ctrl.updateEmployeeAttendance);
router.delete("/:id", validate({ params: employeeAttendanceIdParamSchema }), requirePermission("employee", "update"), ctrl.deleteEmployeeAttendance);

export default router;
