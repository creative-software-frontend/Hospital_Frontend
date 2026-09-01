import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth, optionalAuth } from "../../middleware/auth.middleware";
import * as authController from "./auth.controller";
import { changePasswordSchema, loginSchema } from "./auth.validation";

const router = Router();

// Public
router.post("/login", validate({ body: loginSchema }), authController.login);

// Logout works even without a valid session; optionalAuth lets us audit where known.
router.post("/logout", optionalAuth, authController.logout);

// Authenticated
router.get("/me", requireAuth, authController.me);
router.post(
  "/change-password",
  requireAuth,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

export default router;
