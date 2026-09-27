import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as nurseController from "./nurse.controller";
import {
  createNurseSchema,
  nurseIdParamSchema,
  listNursesQuerySchema,
  updateNurseSchema,
} from "./nurse.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate({ query: listNursesQuerySchema }),
  requirePermission("nurse", "read"),
  nurseController.listNurses,
);

// Declared before "/:id" so the literal path is matched first.
router.get(
  "/shift-types",
  requirePermission("nurse", "read"),
  nurseController.listShiftTypes,
);

router.get(
  "/:id",
  validate({ params: nurseIdParamSchema }),
  requirePermission("nurse", "read"),
  nurseController.getNurse,
);

router.post(
  "/",
  validate({ body: createNurseSchema }),
  requirePermission("nurse", "create"),
  nurseController.createNurse,
);

router.patch(
  "/:id",
  validate({ params: nurseIdParamSchema, body: updateNurseSchema }),
  requirePermission("nurse", "update"),
  nurseController.updateNurse,
);

export default router;
