import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as ctrl from "./employee-evaluation.controller";
import {
  createEmployeeEvaluationSchema,
  employeeEvaluationIdParamSchema,
  listEmployeeEvaluationsQuerySchema,
  updateEmployeeEvaluationSchema,
} from "./employee-evaluation.validation";

const router = Router();
router.use(requireAuth);

router.get("/", validate({ query: listEmployeeEvaluationsQuerySchema }), requirePermission("employee", "read"), ctrl.listEmployeeEvaluations);
router.get("/:id", validate({ params: employeeEvaluationIdParamSchema }), requirePermission("employee", "read"), ctrl.getEmployeeEvaluation);
router.post("/", validate({ body: createEmployeeEvaluationSchema }), requirePermission("employee", "create"), ctrl.createEmployeeEvaluation);
router.patch("/:id", validate({ params: employeeEvaluationIdParamSchema, body: updateEmployeeEvaluationSchema }), requirePermission("employee", "update"), ctrl.updateEmployeeEvaluation);
router.delete("/:id", validate({ params: employeeEvaluationIdParamSchema }), requirePermission("employee", "update"), ctrl.deleteEmployeeEvaluation);

export default router;
