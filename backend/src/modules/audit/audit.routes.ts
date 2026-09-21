import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as auditController from "./audit.controller";
import { listAuditQuerySchema } from "./audit.validation";

const router = Router();

router.use(requireAuth);

// `audit:read` is seeded for SUPER_ADMIN and ADMIN; all other roles are denied
// by the permission guard and additionally branch-scoped in the service.
router.get(
  "/",
  validate({ query: listAuditQuerySchema }),
  requirePermission("audit", "read"),
  auditController.listAuditLogs,
);

router.get(
  "/export",
  validate({ query: listAuditQuerySchema }),
  requirePermission("audit", "read"),
  auditController.exportAuditLogsCsv,
);

export default router;