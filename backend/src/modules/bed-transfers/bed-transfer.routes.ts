import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validation.middleware";
import * as controller from "./bed-transfer.controller";
import {
  createBedTransferSchema,
  listBedTransfersQuerySchema,
  bedTransferIdParamSchema,
  updateBedTransferSchema,
} from "./bed-transfer.validation";

const router = Router();
router.use(requireAuth);

// Bed Transfer reuses the nursing-note permissions (same nursing staff).
router.get(
  "/",
  validate({ query: listBedTransfersQuerySchema }),
  requirePermission("nursingNote", "read"),
  controller.listBedTransfers,
);
router.get(
  "/:id",
  validate({ params: bedTransferIdParamSchema }),
  requirePermission("nursingNote", "read"),
  controller.getBedTransfer,
);
router.post(
  "/",
  validate({ body: createBedTransferSchema }),
  requirePermission("nursingNote", "create"),
  controller.createBedTransfer,
);
router.patch(
  "/:id",
  validate({ params: bedTransferIdParamSchema, body: updateBedTransferSchema }),
  requirePermission("nursingNote", "update"),
  controller.updateBedTransfer,
);
router.delete(
  "/:id",
  validate({ params: bedTransferIdParamSchema }),
  requirePermission("nursingNote", "update"),
  controller.deleteBedTransfer,
);

export default router;
