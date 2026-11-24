import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as ctrl from "./supplier.controller";
import {
  createSupplierSchema,
  listSuppliersQuerySchema,
  supplierIdParamSchema,
  updateSupplierSchema,
} from "./supplier.validation";

const router = Router();
router.use(requireAuth);

router.get("/", validate({ query: listSuppliersQuerySchema }), requirePermission("supplier", "read"), ctrl.listSuppliers);
router.get("/:id", validate({ params: supplierIdParamSchema }), requirePermission("supplier", "read"), ctrl.getSupplier);
router.post("/", validate({ body: createSupplierSchema }), requirePermission("supplier", "create"), ctrl.createSupplier);
router.patch("/:id", validate({ params: supplierIdParamSchema, body: updateSupplierSchema }), requirePermission("supplier", "update"), ctrl.updateSupplier);
router.delete("/:id", validate({ params: supplierIdParamSchema }), requirePermission("supplier", "update"), ctrl.deleteSupplier);

export default router;
