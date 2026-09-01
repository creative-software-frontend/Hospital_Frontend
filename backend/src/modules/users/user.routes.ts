import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as userController from "./user.controller";
import {
  createUserSchema,
  idParamSchema,
  listUsersQuerySchema,
  updateUserSchema,
  updateUserStatusSchema,
} from "./user.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate({ query: listUsersQuerySchema }),
  requirePermission("user", "read"),
  userController.listUsers,
);
router.get(
  "/:id",
  validate({ params: idParamSchema }),
  requirePermission("user", "read"),
  userController.getUser,
);
router.post(
  "/",
  validate({ body: createUserSchema }),
  requirePermission("user", "create"),
  userController.createUser,
);
router.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateUserSchema }),
  requirePermission("user", "update"),
  userController.updateUser,
);
router.patch(
  "/:id/status",
  validate({ params: idParamSchema, body: updateUserStatusSchema }),
  requirePermission("user", "update"),
  userController.updateUserStatus,
);

export default router;
