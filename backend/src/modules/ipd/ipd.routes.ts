import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as ipdController from "./ipd.controller";
import {
  createAdmissionSchema,
  dischargeAdmissionSchema,
  transferBedSchema,
  listAdmissionsQuerySchema,
} from "./ipd.validation";

const router = Router();
router.use(requireAuth);

router.get("/fee-config", requirePermission("ipd", "read"), ipdController.getIpdFeeConfig);

router.get(
  "/admissions",
  validate({ query: listAdmissionsQuerySchema }),
  requirePermission("ipd", "read"),
  ipdController.listAdmissions,
);

router.post(
  "/admissions",
  validate({ body: createAdmissionSchema }),
  requirePermission("ipd", "create"),
  ipdController.createAdmission,
);

router.patch(
  "/admissions/:id/discharge",
  validate({ body: dischargeAdmissionSchema }),
  requirePermission("ipd", "update"),
  ipdController.dischargeAdmission,
);

router.patch(
  "/admissions/:id/transfer-bed",
  validate({ body: transferBedSchema }),
  requirePermission("ipd", "update"),
  ipdController.transferBed,
);

export default router;
