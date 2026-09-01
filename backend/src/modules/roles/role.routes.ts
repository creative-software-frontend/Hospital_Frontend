import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as roleController from "./role.controller";
import { roleIdParamSchema } from "./role.validation";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("role", "read"), roleController.listRoles);
router.get(
  "/:id",
  validate({ params: roleIdParamSchema }),
  requirePermission("role", "read"),
  roleController.getRole,
);

export default router;
