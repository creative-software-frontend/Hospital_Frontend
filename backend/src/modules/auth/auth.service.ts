import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { config } from "../../config";
import {
  AuthenticationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../errors/ApiError";
import { signAccessToken } from "../../utils/token";
import { writeAuditLog } from "../../utils/audit";
import type { AuthUser } from "../../types/auth";
import type { ChangePasswordInput, LoginInput } from "./auth.validation";

// Used to return a stable, generic message so the API does not reveal whether
// a given identifier exists.
const INVALID_CREDENTIALS = "Invalid email/username or password";

export interface LoginResult {
  user: {
    id: number;
    email: string;
    username: string | null;
    name: string;
    status: string;
    branchId: number;
  };
  roles: string[];
  accessToken: string;
}

export interface SafeUser {
  id: number;
  email: string;
  username: string | null;
  name: string;
  status: string;
  branchId: number;
}

async function getUserWithRoles(identifier: string) {
  return prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      password: true,
      status: true,
      branchId: true,
      branch: { select: { id: true, name: true, code: true } },
      userRoles: {
        select: {
          role: { select: { id: true, seederKey: true, name: true } },
        },
      },
    },
  });
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const identifier = input.identifier.trim();
  const user = await getUserWithRoles(identifier);

  // Generic failure for both "unknown identifier" and "wrong password".
  if (!user) {
    throw new AuthenticationError(INVALID_CREDENTIALS);
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password);
  if (!passwordMatches) {
    await writeAuditLog({
      module: "AUTH",
      action: "LOGIN_FAILED",
      user: null,
      branchId: user.branchId,
    });
    throw new AuthenticationError(INVALID_CREDENTIALS);
  }

  if (user.status !== "ACTIVE") {
    await writeAuditLog({
      module: "AUTH",
      action: "LOGIN_BLOCKED",
      user: null,
      branchId: user.branchId,
    });
    throw new AuthenticationError("Account is not active");
  }

  // Record last login timestamp.
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const roles = user.userRoles.map((ur) => ur.role.seederKey);
  const accessToken = signAccessToken({
    sub: String(user.id),
    email: user.email,
    name: user.name,
  });

  await writeAuditLog({
    module: "AUTH",
    action: "LOGIN_SUCCESS",
    tableName: "User",
    recordId: String(user.id),
    user: userToAuth(user),
    branchId: user.branchId,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      status: user.status,
      branchId: user.branchId,
    },
    roles,
    accessToken,
  };
}

/**
 * Loads the current user fresh from the database (never from JWT claims) so
 * that status/role changes take effect immediately.
 */
export async function getCurrentUser(userId: number): Promise<{ user: SafeUser; roles: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      status: true,
      branchId: true,
      userRoles: {
        select: { role: { select: { id: true, seederKey: true, name: true } } },
      },
    },
  });

  if (!user) {
    throw new AuthenticationError("User no longer exists");
  }

  if (user.status !== "ACTIVE") {
    throw new AuthenticationError("Account is not active");
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      status: user.status,
      branchId: user.branchId,
    },
    roles: user.userRoles.map((ur) => ur.role.seederKey),
  };
}

export async function changePassword(authUser: AuthUser, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, password: true, status: true, branchId: true },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new AuthenticationError("Account is not active");
  }

  const matches = await bcrypt.compare(input.currentPassword, user.password);
  if (!matches) {
    throw new AuthenticationError("Current password is incorrect");
  }

  // Reject reusing the same password.
  const isSame = await bcrypt.compare(input.newPassword, user.password);
  if (isSame) {
    throw new BusinessRuleError("New password must be different from the current password");
  }

  const newHash = await bcrypt.hash(input.newPassword, config.bcryptSaltRounds);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: newHash },
  });

  await writeAuditLog({
    module: "AUTH",
    action: "PASSWORD_CHANGED",
    tableName: "User",
    recordId: String(user.id),
    user: authUser,
    branchId: user.branchId,
  });

  // NOTE: The current schema has no token/session-versioning field, so an
  // already-issued JWT remains technically valid until it expires. We do not
  // introduce a fragile workaround here. The middleware still reloads the user
  // and status from the DB on every request, so a disabled user is rejected
  // immediately. Recommended future hardening: add a `tokenVersion` column and
  // include it in the JWT so this can be revoked atomically.
}

export async function logoutSuccess(authUser: AuthUser): Promise<void> {
  await writeAuditLog({
    module: "AUTH",
    action: "LOGOUT",
    tableName: "User",
    recordId: String(authUser.id),
    user: authUser,
    branchId: authUser.branchId,
  });
}

export async function getUserByIdOrThrow(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      phone: true,
      status: true,
      branchId: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      branch: { select: { id: true, name: true, code: true } },
      userRoles: {
        select: { role: { select: { id: true, seederKey: true, name: true } } },
      },
    },
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user;
}

function userToAuth(user: {
  id: number;
  email: string;
  username: string | null;
  name: string;
  status: string;
  branchId: number;
  userRoles: { role: { id: number; seederKey: string; name: string } }[];
}): AuthUser {
  return {
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

export function assertActiveUser(user: { id: number; status: string; branchId: number }): void {
  if (user.status !== "ACTIVE") {
    throw new ConflictError("User is not active");
  }
}

export { INVALID_CREDENTIALS };
