import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as serviceController from "./service.controller";
import {
  createServiceSchema,
  listServicesQuerySchema,
  serviceIdParamSchema,
  updateServiceSchema,
} from "./service.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate({ query: listServicesQuerySchema }),
  requirePermission("service", "read"),
  serviceController.listServices,
);

router.get(
  "/categories",
  requirePermission("service", "read"),
  serviceController.listServiceCategories,
);

router.get(
  "/:id",
  validate({ params: serviceIdParamSchema }),
  requirePermission("service", "read"),
  serviceController.getService,
);

router.post(
  "/",
  validate({ body: createServiceSchema }),
  requirePermission("service", "create"),
  serviceController.createService,
);

router.patch(
  "/:id",
  validate({ params: serviceIdParamSchema, body: updateServiceSchema }),
  requirePermission("service", "update"),
  serviceController.updateService,
);

export default router;