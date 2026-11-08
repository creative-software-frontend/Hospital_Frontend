import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as shiftTypeController from "./shift-type.controller";
import {
  createShiftTypeSchema,
  listShiftTypesQuerySchema,
  shiftTypeIdParamSchema,
  updateShiftTypeSchema,
} from "./shift-type.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate({ query: listShiftTypesQuerySchema }),
  requirePermission("nursingNote", "read"),
  shiftTypeController.listShiftTypes,
);
router.get(
  "/:id",
  validate({ params: shiftTypeIdParamSchema }),
  requirePermission("nursingNote", "read"),
  shiftTypeController.getShiftType,
);
router.post(
  "/",
  validate({ body: createShiftTypeSchema }),
  requirePermission("nursingNote", "create"),
  shiftTypeController.createShiftType,
);
router.patch(
  "/:id",
  validate({ params: shiftTypeIdParamSchema, body: updateShiftTypeSchema }),
  requirePermission("nursingNote", "update"),
  shiftTypeController.updateShiftType,
);

export default router;
