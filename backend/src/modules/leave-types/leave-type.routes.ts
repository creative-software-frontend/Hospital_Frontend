import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as leaveTypeController from "./leave-type.controller";
import {
  createLeaveTypeSchema,
  leaveTypeIdParamSchema,
  listLeaveTypesQuerySchema,
  updateLeaveTypeSchema,
} from "./leave-type.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate({ query: listLeaveTypesQuerySchema }),
  requirePermission("employee", "read"),
  leaveTypeController.listLeaveTypes,
);
router.get(
  "/:id",
  validate({ params: leaveTypeIdParamSchema }),
  requirePermission("employee", "read"),
  leaveTypeController.getLeaveType,
);
router.post(
  "/",
  validate({ body: createLeaveTypeSchema }),
  requirePermission("employee", "create"),
  leaveTypeController.createLeaveType,
);
router.patch(
  "/:id",
  validate({ params: leaveTypeIdParamSchema, body: updateLeaveTypeSchema }),
  requirePermission("employee", "update"),
  leaveTypeController.updateLeaveType,
);
router.delete(
  "/:id",
  validate({ params: leaveTypeIdParamSchema }),
  requirePermission("employee", "update"),
  leaveTypeController.deleteLeaveType,
);

export default router;
