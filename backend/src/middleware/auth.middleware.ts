import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { config } from "../config";
import { asyncHandler } from "../utils/asyncHandler";
import { AuthenticationError } from "../errors/ApiError";
import type { AuthUser } from "../types/auth";

interface TokenPayload extends JwtPayload {
  sub: string;
}

/**
 * Express middleware that authenticates the request from the HTTP-only JWT
 * cookie. It verifies the token and loads the current user (with roles) fresh
 * from the database so that deactivated/locked users are rejected immediately.
 *
 * NEVER trusts role, branchId or userId from the client — the authenticated
 * identity is built entirely from the verified token + server-side DB lookup.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  void doAuth(req)
    .then(() => next())
    .catch(next);
}

async function doAuth(req: Request): Promise<void> {
  const token = req.cookies?.[config.jwtCookieName];
  if (!token) {
    throw new AuthenticationError("Authentication required");
  }

  let payload: TokenPayload;
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    if (typeof decoded.sub !== "string") {
      throw new AuthenticationError("Invalid token");
    }
    payload = decoded;
  } catch {
    throw new AuthenticationError("Invalid or expired token");
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) {
    throw new AuthenticationError("Invalid token");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      branchId: true,
      status: true,
      userRoles: {
        select: {
          role: { select: { id: true, seederKey: true, name: true } },
        },
      },
    },
  });

  if (!user) {
    throw new AuthenticationError("User no longer exists");
  }

  if (user.status !== "ACTIVE") {
    throw new AuthenticationError("Account is not active");
  }

  const authUser: AuthUser = {
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

  req.user = authUser;
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

  let payload: TokenPayload;
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    if (typeof decoded.sub !== "string") {
      next();
      return;
    }
    payload = decoded;
  } catch {
    next();
    return;
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) {
    next();
    return;
  }

  void prisma.user
    .findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        branchId: true,
        status: true,
        userRoles: {
          select: { role: { select: { id: true, seederKey: true, name: true } } },
        },
      },
    })
    .then((user) => {
      if (user && user.status === "ACTIVE") {
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
      next();
    })
    .catch(() => next());
}
