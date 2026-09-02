import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as branchController from "./branch.controller";
import {
  branchIdParamSchema,
  listBranchesQuerySchema,
  updateBranchSchema,
} from "./branch.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate({ query: listBranchesQuerySchema }),
  requirePermission("branch", "read"),
  branchController.listBranches,
);

router.get(
  "/:id",
  validate({ params: branchIdParamSchema }),
  requirePermission("branch", "read"),
  branchController.getBranch,
);

router.patch(
  "/:id",
  validate({ params: branchIdParamSchema, body: updateBranchSchema }),
  requirePermission("branch", "update"),
  branchController.updateBranch,
);

export default router;