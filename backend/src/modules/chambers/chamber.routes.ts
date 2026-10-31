import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as ctrl from "./chamber.controller";
import {
  chamberIdParamSchema,
  createChamberSchema,
  listChambersQuerySchema,
  updateChamberSchema,
} from "./chamber.validation";

const router = Router();
router.use(requireAuth);

router.get("/", validate({ query: listChambersQuerySchema }), requirePermission("doctor", "read"), ctrl.listChambers);
router.get("/:id", validate({ params: chamberIdParamSchema }), requirePermission("doctor", "read"), ctrl.getChamber);
router.post("/", validate({ body: createChamberSchema }), requirePermission("doctor", "create"), ctrl.createChamber);
router.patch("/:id", validate({ params: chamberIdParamSchema, body: updateChamberSchema }), requirePermission("doctor", "update"), ctrl.updateChamber);
router.delete("/:id", validate({ params: chamberIdParamSchema }), requirePermission("doctor", "update"), ctrl.deleteChamber);

export default router;
