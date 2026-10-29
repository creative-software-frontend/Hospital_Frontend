import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as emergencyController from "./emergency.controller";
import {
  createEmergencyCaseSchema,
  listEmergencyCasesQuerySchema,
} from "./emergency.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/cases",
  validate({ query: listEmergencyCasesQuerySchema }),
  requirePermission("emergency", "read"),
  emergencyController.listEmergencyCases,
);

router.post(
  "/cases",
  validate({ body: createEmergencyCaseSchema }),
  requirePermission("emergency", "create"),
  emergencyController.registerEmergencyCase,
);

export default router;
