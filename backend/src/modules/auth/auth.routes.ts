import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth, optionalAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import {
  changePasswordRateLimiter,
  loginRateLimiter,
  twoFactorRateLimiter,
} from "../../utils/rateLimit";
import * as authController from "./auth.controller";
import {
  adminResetPasswordSchema,
  changePasswordSchema,
  loginSchema,
  revokeSessionsSchema,
  twoFactorDisableSchema,
  twoFactorSetupSchema,
} from "./auth.validation";

const router = Router();

// Public. Two limiters defend the network; the per-account lockout lives in the
// service so it is persisted and auditable rather than process-local.
router.post(
  "/login",
  loginRateLimiter,
  twoFactorRateLimiter,
  validate({ body: loginSchema }),
  authController.login,
);

// Logout works even without a valid session; optionalAuth lets us audit where known.
router.post("/logout", optionalAuth, authController.logout);

// Authenticated
router.get("/me", requireAuth, authController.me);
router.get("/password-policy", requireAuth, authController.passwordPolicy);
router.post(
  "/change-password",
  requireAuth,
  changePasswordRateLimiter,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

// Two-factor authentication
router.get("/2fa/status", requireAuth, authController.twoFactorStatus);
router.post("/2fa/setup", requireAuth, authController.setupTwoFactor);
router.post(
  "/2fa/confirm",
  requireAuth,
  twoFactorRateLimiter,
  validate({ body: twoFactorSetupSchema }),
  authController.confirmTwoFactor,
);
router.post(
  "/2fa/disable",
  requireAuth,
  twoFactorRateLimiter,
  validate({ body: twoFactorDisableSchema }),
  authController.disableTwoFactor,
);
router.post("/2fa/recovery-codes", requireAuth, authController.regenerateRecoveryCodes);

// Sessions / devices
router.get("/sessions", requireAuth, authController.listSessions);
router.post(
  "/sessions/revoke",
  requireAuth,
  validate({ body: revokeSessionsSchema }),
  authController.revokeSessions,
);

router.get("/login-attempts", requireAuth, authController.listLoginAttempts);

/* Administrative account recovery. Both are Super Admin only: they can set a
 * password for someone else and clear a lockout, so they are deliberately not
 * part of the self-service surface. */
router.post(
  "/users/:id/reset-password",
  requireAuth,
  requirePermission("user", "update"),
  validate({ body: adminResetPasswordSchema }),
  authController.adminResetPassword,
);

router.post(
  "/users/:id/unlock",
  requireAuth,
  requirePermission("user", "update"),
  authController.adminUnlockUser,
);

export default router;