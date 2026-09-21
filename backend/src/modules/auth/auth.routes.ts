import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth, optionalAuth } from "../../middleware/auth.middleware";
import { loginRateLimiter, changePasswordRateLimiter } from "../../utils/rateLimit";
import * as authController from "./auth.controller";
import { changePasswordSchema, loginSchema } from "./auth.validation";

const router = Router();

// Public — brute-force protection applied before validation.
router.post("/login", loginRateLimiter, validate({ body: loginSchema }), authController.login);

// Logout works even without a valid session; optionalAuth lets us audit where known.
router.post("/logout", optionalAuth, authController.logout);

// Authenticated
router.get("/me", requireAuth, authController.me);
router.post(
  "/change-password",
  requireAuth,
  changePasswordRateLimiter,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

export default router;
