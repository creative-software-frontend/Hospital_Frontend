import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AuthorizationError } from "../errors/ApiError";

type RoleKey = string;

/**
 * Guards a route to the given canonical roles (seederKeys), e.g.
 *   requireRole("SUPER_ADMIN")
 *   requireRole("ADMIN", "SUPER_ADMIN")
 * Roles come from `req.user.roles` (server-side identity), never the client.
 */
export function requireRole(...allowedRoleKeys: RoleKey[]) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      throw new AuthorizationError("Authentication required");
    }

    const hasRole = user.roles.some((r) => allowedRoleKeys.includes(r.seederKey));
    if (!hasRole) {
      throw new AuthorizationError("You do not have permission to perform this action");
    }

    next();
  });
}
