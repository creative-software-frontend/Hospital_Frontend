import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import {
  createMedicineSchema,
  createBatchSchema,
  dispenseMedicineSchema,
  adjustStockSchema,
  listMedicinesQuerySchema,
} from "./pharmacy.validation";
import * as pharmacyController from "./pharmacy.controller";

const router = Router();

router.use(requireAuth);

router.get("/config", pharmacyController.getPharmacyConfig);

router.post(
  "/medicines",
  validate({ body: createMedicineSchema }),
  requirePermission("medicine", "update"),
  pharmacyController.createMedicine
);

router.get(
  "/medicines",
  validate({ query: listMedicinesQuerySchema }),
  requirePermission("medicine", "read"),
  pharmacyController.listMedicines
);

router.post(
  "/batches",
  validate({ body: createBatchSchema }),
  requirePermission("stockMovement", "create"),
  pharmacyController.createBatch
);

router.get(
  "/medicines/:medicineId/batches",
  requirePermission("medicine", "read"),
  pharmacyController.listBatches
);

router.post(
  "/dispense",
  validate({ body: dispenseMedicineSchema }),
  requirePermission("stockMovement", "create"),
  pharmacyController.dispenseMedicine
);

router.post(
  "/adjust-stock",
  validate({ body: adjustStockSchema }),
  requirePermission("stockMovement", "create"),
  pharmacyController.adjustStock
);

export default router;
