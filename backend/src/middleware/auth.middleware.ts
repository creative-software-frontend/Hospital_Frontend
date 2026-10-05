import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { config } from "../config";
import { asyncHandler } from "../utils/asyncHandler";
import { AuthenticationError, PrerequisiteError } from "../errors/ApiError";
import { assertSessionActive } from "../modules/auth/auth.service";
import type { AuthUser } from "../types/auth";

interface TokenPayload extends JwtPayload {
  sub: string;
  jti: string;
  tv: number;
}

/**
 * Express middleware that authenticates the request from the HTTP-only JWT
 * cookie. It verifies the token, confirms the server-side session is still
 * active (so the configured session timeout, device limits and logout really
 * revoke access), and loads the current user with roles fresh from the database
 * so deactivated/locked users are rejected immediately.
 *
 * NEVER trusts role, branchId or userId from the client — the authenticated
 * identity is built entirely from the verified token + server-side DB lookup.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  void doAuth(req, true)
    .then(() => next())
    .catch(next);
}

/** Attach the verified token's session id so logout can revoke it. */
declare module "express-serve-static-core" {
  interface Request {
    sessionId?: string;
  }
}

async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    if (typeof decoded.sub !== "string" || typeof decoded.jti !== "string") {
      throw new AuthenticationError("Invalid token");
    }
    return decoded;
  } catch {
    throw new AuthenticationError("Invalid or expired token");
  }
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  username: true,
  branchId: true,
  status: true,
  mustChangePassword: true,
  userRoles: {
    select: {
      role: { select: { id: true, seederKey: true, name: true } },
    },
  },
} as const;

/**
 * Endpoints a user flagged `mustChangePassword` may still reach. Everything
 * else is refused until a new password is set, so an expired-password session
 * cannot touch patient data.
 */
const PASSWORD_CHANGE_ALLOWLIST = [
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/change-password",
  "/api/auth/password-policy",
  "/api/auth/2fa/status",
  "/api/auth/sessions",
];

async function doAuth(req: Request, enforceSession: boolean): Promise<void> {
  const token = req.cookies?.[config.jwtCookieName];
  if (!token) {
    throw new AuthenticationError("Authentication required");
  }

  const payload = await verifyToken(token);
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) {
    throw new AuthenticationError("Invalid token");
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
  if (!user) {
    throw new AuthenticationError("User no longer exists");
  }
  if (user.status !== "ACTIVE") {
    throw new AuthenticationError("Account is not active");
  }

  if (enforceSession) {
    await assertSessionActive({
      userId,
      tokenId: payload.jti,
      tokenVersion: Number(payload.tv ?? 0),
    });

    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWLIST.includes(req.originalUrl)) {
      throw new PrerequisiteError(
        "Your password must be changed before you can continue. Set a new password to regain access.",
        "PASSWORD_CHANGE_REQUIRED",
      );
    }
  }

  req.sessionId = payload.jti;
  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    branchId: user.branchId,
    status: user.status,
    roles: user.userRoles.map((ur) => ({
      id: ur.role.id,
      seederKey: ur.role.seederKey,
      name: ur.role.name,
    })),
  };
}

/**
 * Optional authentication middleware. Populates `req.user` when a valid
 * HTTP-only JWT cookie is present, but does NOT reject unauthenticated
 * requests. Useful for endpoints that behave differently with/without a
 * session (e.g. logout).
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[config.jwtCookieName];
  if (!token) {
    next();
    return;
  }

  void (async () => {
    try {
      const payload = await verifyToken(token);
      const userId = Number(payload.sub);
      if (!Number.isInteger(userId)) {
        next();
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
      if (user && user.status === "ACTIVE") {
        await assertSessionActive({
          userId,
          tokenId: payload.jti,
          tokenVersion: Number(payload.tv ?? 0),
        });
        req.sessionId = payload.jti;
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          branchId: user.branchId,
          status: user.status,
          roles: user.userRoles.map((ur) => ({
            id: ur.role.id,
            seederKey: ur.role.seederKey,
            name: ur.role.name,
          })),
        };
      }
    } catch {
      // An invalid or expired session is simply treated as "not signed in".
    }
    next();
  })();
}