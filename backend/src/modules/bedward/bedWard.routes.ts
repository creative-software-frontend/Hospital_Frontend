import { Router, type Request } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import * as bedWardController from "./bedWard.controller";
import type { BedWardKind } from "./bedWard.registry";
import {
  bedWardIdParamSchema,
  bedWardKindParamSchema,
  createBedWardSchemaByKind,
  listBedWardQuerySchema,
  updateBedWardSchemaByKind,
} from "./bedWard.validation";

const router = Router();

router.use(requireAuth);

const kindOf = (req: Request): BedWardKind => req.params.kind as BedWardKind;

// SUPER_ADMIN-only, branch-scoped Bed & Ward setup lists. The role check lives
// in the service so it can never be bypassed by routing. The body schema
// depends on the `:kind`, so the kind param is validated first.

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
  validate({ params: bedWardKindParamSchema }),
  validate({ body: (req) => createBedWardSchemaByKind[kindOf(req)] }),
  bedWardController.createBedWard,
);

router.patch(
  "/:kind/:id",
  validate({ params: bedWardIdParamSchema }),
  validate({ body: (req) => updateBedWardSchemaByKind[kindOf(req)] }),
  bedWardController.updateBedWard,
);

export default router;
