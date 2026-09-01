import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { AuthorizationError } from "../errors/ApiError";

/**
 * Guards a route by permission, e.g. requirePermission("PATIENT", "READ").
 * Resolves the authenticated user's role ids from the server-side identity and
 * checks the RolePermission / Permission tables in the database.
 */
export function requirePermission(module: string, action: string) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      throw new AuthorizationError("Authentication required");
    }

    const roleIds = user.roles.map((r) => r.id);
    if (roleIds.length === 0) {
      throw new AuthorizationError("You do not have permission to perform this action");
    }

    const count = await prisma.rolePermission.count({
      where: {
        roleId: { in: roleIds },
        permission: {
          module,
          action,
        },
      },
    });

    if (count === 0) {
      throw new AuthorizationError(
        `Missing permission: ${module}:${action}`,
      );
    }

    next();
  });
}
