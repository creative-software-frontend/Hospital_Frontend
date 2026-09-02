import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as departmentController from "./department.controller";
import {
  createDepartmentSchema,
  departmentIdParamSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from "./department.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate({ query: listDepartmentsQuerySchema }),
  requirePermission("department", "read"),
  departmentController.listDepartments,
);

router.get(
  "/:id",
  validate({ params: departmentIdParamSchema }),
  requirePermission("department", "read"),
  departmentController.getDepartment,
);

router.post(
  "/",
  validate({ body: createDepartmentSchema }),
  requirePermission("department", "create"),
  departmentController.createDepartment,
);

router.patch(
  "/:id",
  validate({ params: departmentIdParamSchema, body: updateDepartmentSchema }),
  requirePermission("department", "update"),
  departmentController.updateDepartment,
);

export default router;