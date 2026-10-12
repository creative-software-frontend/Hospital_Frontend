import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import * as bedWardController from "./bedWard.controller";
import {
  bedWardIdParamSchema,
  bedWardKindParamSchema,
  createBedWardSchema,
  listBedWardQuerySchema,
  updateBedWardSchema,
} from "./bedWard.validation";

const router = Router();

router.use(requireAuth);

// SUPER_ADMIN-only, branch-scoped Bed & Ward setup lists. The role check lives
// in the service so it can never be bypassed by routing.

router.get(
  "/:kind",
  validate({ params: bedWardKindParamSchema, query: listBedWardQuerySchema }),
  bedWardController.listBedWard,
);

router.get(
  "/:kind/:id",
  validate({ params: bedWardIdParamSchema }),
  bedWardController.getBedWard,
);

router.post(
  "/:kind",
  validate({ params: bedWardKindParamSchema, body: createBedWardSchema }),
  bedWardController.createBedWard,
);

router.patch(
  "/:kind/:id",
  validate({ params: bedWardIdParamSchema, body: updateBedWardSchema }),
  bedWardController.updateBedWard,
);

export default router;
