import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as roleController from "./role.controller";
import {
  roleIdParamSchema,
  updateRolePermissionsSchema,
} from "./role.validation";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("role", "read"), roleController.listRoles);
router.get(
  "/:id",
  validate({ params: roleIdParamSchema }),
  requirePermission("role", "read"),
  roleController.getRole,
);
router.put(
  "/:id/permissions",
  validate({ params: roleIdParamSchema, body: updateRolePermissionsSchema }),
  requirePermission("role", "update"),
  roleController.updateRolePermissions,
);

export default router;
