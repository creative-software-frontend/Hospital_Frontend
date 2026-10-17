import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as employeeController from "./employee.controller";
import {
  createEmployeeSchema,
  employeeIdParamSchema,
  listEmployeesQuerySchema,
  updateEmployeeSchema,
} from "./employee.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate({ query: listEmployeesQuerySchema }),
  requirePermission("employee", "read"),
  employeeController.listEmployees,
);

// Declared before "/:id" so the literal paths are matched first.
router.get(
  "/next-code",
  requirePermission("employee", "create"),
  employeeController.nextCode,
);

router.get(
  "/references",
  requirePermission("employee", "read"),
  employeeController.listReferences,
);

router.get(
  "/:id",
  validate({ params: employeeIdParamSchema }),
  requirePermission("employee", "read"),
  employeeController.getEmployee,
);

router.post(
  "/",
  validate({ body: createEmployeeSchema }),
  requirePermission("employee", "create"),
  employeeController.createEmployee,
);

router.patch(
  "/:id",
  validate({ params: employeeIdParamSchema, body: updateEmployeeSchema }),
  requirePermission("employee", "update"),
  employeeController.updateEmployee,
);

export default router;
