import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { setAuthCookie, clearAuthCookie } from "../../utils/cookie";
import * as authService from "./auth.service";

/**
 * POST /api/auth/login
 * Authenticates a user, sets the HTTP-only cookie, returns sanitized user.
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);

  setAuthCookie(res, result.accessToken);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: result.user,
      roles: result.roles,
    },
  });
});

/**
 * POST /api/auth/logout
 * Clears the cookie (works even if absent) and returns success.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await authService.logoutSuccess(req.user);
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
 * POST /api/auth/change-password
 * Verifies the current password, hashes and stores the new one.
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(req.user!, req.body);
  res.status(200).json({ success: true, message: "Password changed successfully" });
});
