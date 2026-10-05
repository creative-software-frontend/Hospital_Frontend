import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { setAuthCookie, clearAuthCookie } from "../../utils/cookie";
import * as authService from "./auth.service";
import * as twoFactorService from "./twoFactor.service";

/** IP + user agent are security evidence, so every auth route forwards them. */
function meta(req: Request) {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}

/**
 * POST /api/auth/login
 * Authenticates a user, sets the HTTP-only cookie, returns sanitized user.
 *
 * Enforces, in order: IP allow-list, account lockout, password, two-factor
 * challenge, device/session limit, and password-expiry flag.
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body, meta(req));

  // The cookie lifetime is the effective session timeout so the browser and
  // the server-side session expire at the same moment.
  setAuthCookie(res, result.accessToken, result.sessionMaxAgeMs);

  res.status(200).json({
    success: true,
    message: result.mustChangePassword
      ? "Login successful, but you must set a new password to continue"
      : "Login successful",
    data: {
      user: result.user,
      roles: result.roles,
      mustChangePassword: result.mustChangePassword,
    },
  });
});

/**
 * POST /api/auth/logout
 * Revokes the server-side session, clears the cookie and returns success.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await authService.logoutSuccess(req.user, req.sessionId);
  }
  clearAuthCookie(res);
  res.status(200).json({ success: true, message: "Logout successful" });
});

/**
 * GET /api/auth/me
 * Returns the authenticated user's current database state and roles.
 */
export const me = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.getCurrentUser(req.user!.id);
  res.status(200).json({
    success: true,
    data: { user: result.user, roles: result.roles },
  });
});

/**
 * GET /api/auth/password-policy
 * The live password rules, so the change-password screen can show a checklist.
 * Reachable even while `mustChangePassword` is set.
 */
export const passwordPolicy = asyncHandler(async (_req: Request, res: Response) => {
  const policy = await authService.getPasswordPolicyForUser();
  res.status(200).json({ success: true, data: policy });
});

/**
 * POST /api/auth/change-password
 * Verifies the current password and enforces the live password policy and
 * history. Revokes every other session afterwards.
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(req.user!, req.body);
  res.status(200).json({ success: true, message: "Password changed successfully" });
});

/* ------------------------------------------------------------------ *
 * Two-factor authentication
 * ------------------------------------------------------------------ */

/** POST /api/auth/2fa/setup — issue a pending TOTP secret. */
export const setupTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  const preview = await twoFactorService.beginSetup(req.user!);
  res.status(200).json({ success: true, data: preview });
});

/** POST /api/auth/2fa/confirm — activate 2FA and return recovery codes once. */
export const confirmTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  const result = await twoFactorService.confirmSetup(req.user!, req.body.code);
  res.status(200).json({
    success: true,
    message: "Two-factor authentication enabled. Save your recovery codes now.",
    data: result,
  });
});

/** POST /api/auth/2fa/disable — password + code required. */
export const disableTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  await twoFactorService.disable(req.user!, req.body);
  res.status(200).json({ success: true, message: "Two-factor authentication disabled" });
});

/** GET /api/auth/2fa/status */
export const twoFactorStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await twoFactorService.status(req.user!);
  res.status(200).json({ success: true, data: result });
});

/** POST /api/auth/2fa/recovery-codes — replace the recovery code set. */
export const regenerateRecoveryCodes = asyncHandler(async (req: Request, res: Response) => {
  const result = await twoFactorService.regenerateRecoveryCodes(req.user!);
  res.status(200).json({
    success: true,
    message: "New recovery codes generated. The previous codes no longer work.",
    data: result,
  });
});

/* ------------------------------------------------------------------ *
 * Sessions / devices
 * ------------------------------------------------------------------ */

/** GET /api/auth/sessions */
export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  const sessions = await authService.listActiveSessions(req.user!.id);
  res.status(200).json({ success: true, data: sessions });
});

/** POST /api/auth/sessions/revoke — revoke one session, or all when id is omitted. */
export const revokeSessions = asyncHandler(async (req: Request, res: Response) => {
  const revoked = await authService.revokeSessions(req.user!.id, {
    sessionId: req.body?.sessionId,
    reason: req.body?.sessionId ? "revoked-by-user" : "revoke-all",
  });
  if (!req.body?.sessionId) {
    clearAuthCookie(res);
  }
  res.status(200).json({
    success: true,
    message: `Revoked ${revoked} session${revoked === 1 ? "" : "s"}`,
    data: { revoked },
  });
});

/** GET /api/auth/login-attempts — recent sign-in history for this account. */
export const listLoginAttempts = asyncHandler(async (req: Request, res: Response) => {
  const attempts = await authService.listLoginAttempts(req.user!.id);
  res.status(200).json({ success: true, data: attempts });
});

/* ------------------------------------------------------------------ *
 * Administrative account recovery
 * ------------------------------------------------------------------ */

/**
 * POST /api/auth/users/:id/reset-password
 *
 * Super Admin recovery path for a user who cannot sign in. Enforces the live
 * password policy, flags the account as needing its own change, and revokes
 * every session so the old credentials stop working immediately.
 */
export const adminResetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.adminResetPassword(req.user!, Number(req.params.id), req.body);
  res.status(200).json({
    success: true,
    message: "Password reset. The user must choose a new password at next sign-in.",
  });
});

/**
 * POST /api/auth/users/:id/unlock
 *
 * Clears a brute-force lockout that would otherwise block a legitimate user
 * until the window elapses.
 */
export const adminUnlockUser = asyncHandler(async (req: Request, res: Response) => {
  await authService.unlockUser(req.user!, Number(req.params.id));
  res.status(200).json({ success: true, message: "Account unlocked" });
});