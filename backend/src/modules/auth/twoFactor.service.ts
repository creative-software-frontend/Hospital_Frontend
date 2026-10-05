// backend/src/modules/auth/twoFactor.service.ts
// Enrollment lifecycle for the TOTP second factor: generate a secret, confirm
// it with a real code, disable with password + code confirmation, and issue
// single-use recovery codes.

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { config } from "../../config";
import { AuthenticationError, BusinessRuleError, NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import type { AuthUser } from "../../types/auth";
import { getSecurityPolicy } from "./securityPolicy";
import { createRecoveryCodes, generateTotpSecret, otpauthUri, verifyTotp } from "./twoFactor";

const ISSUER = "Hospital Management";

export interface SetupPreview {
  secret: string;
  otpauthUrl: string;
}

/**
 * Step 1 of enrollment: create a pending secret. It is stored immediately so
 * the user can scan it, but 2FA is not active until they confirm a code.
 */
export async function beginSetup(authUser: AuthUser): Promise<SetupPreview> {
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, branchId: true, email: true, twoFactorEnabled: true },
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret, twoFactorEnabled: false },
  });

  await writeAuditLog({
    module: "SECURITY",
    action: "TWO_FACTOR_SETUP_STARTED",
    tableName: "User",
    recordId: String(user.id),
    user: authUser,
    branchId: user.branchId,
    always: true,
  });

  return {
    secret,
    otpauthUrl: otpauthUri({ secret, accountName: user.email, issuer: ISSUER }),
  };
}

/**
 * Step 2: confirm the secret by proving the authenticator app generates the
 * expected code. Only then is 2FA switched on and recovery codes issued.
 */
export async function confirmSetup(
  authUser: AuthUser,
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, branchId: true, twoFactorSecret: true, twoFactorEnabled: true },
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  if (!user.twoFactorSecret) {
    throw new BusinessRuleError("Start two-factor setup before confirming a code");
  }
  if (!verifyTotp(user.twoFactorSecret, code)) {
    throw new BusinessRuleError("That code is not valid. Check your authenticator app and try again.");
  }

  const { plain, hashes } = await createRecoveryCodes(8, (p) =>
    bcrypt.hash(p, config.bcryptSaltRounds),
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true, twoFactorRecovery: hashes },
  });

  await writeAuditLog({
    module: "SECURITY",
    action: "TWO_FACTOR_ENABLED",
    tableName: "User",
    recordId: String(user.id),
    user: authUser,
    branchId: user.branchId,
    newValues: { recoveryCodeCount: hashes.length },
    always: true,
  });

  // Plaintext recovery codes are returned exactly once.
  return { recoveryCodes: plain };
}

/** Turn 2FA off. Requires the password and, when enrolled, a valid code. */
export async function disable(
  authUser: AuthUser,
  input: { currentPassword: string; code?: string },
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      branchId: true,
      password: true,
      twoFactorSecret: true,
      twoFactorEnabled: true,
      twoFactorRecovery: true,
    },
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const ok = await bcrypt.compare(input.currentPassword, user.password);
  if (!ok) {
    throw new AuthenticationError("Current password is incorrect");
  }
  if (user.twoFactorEnabled) {
    if (!input.code) {
      throw new BusinessRuleError("A current two-factor code is required to disable 2FA");
    }
    if (!user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, input.code)) {
      throw new BusinessRuleError("That two-factor code is not valid");
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      // Prisma needs an explicit DbNull to store SQL NULL in a nullable Json column.
      twoFactorRecovery: Prisma.DbNull,
    },
  });

  await writeAuditLog({
    module: "SECURITY",
    action: "TWO_FACTOR_DISABLED",
    tableName: "User",
    recordId: String(user.id),
    user: authUser,
    branchId: user.branchId,
    always: true,
  });
}

/** Current 2FA state plus how many recovery codes remain. */
export async function status(authUser: AuthUser) {
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorRecovery: true,
    },
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  const policy = await getSecurityPolicy();
  return {
    globallyEnabled: policy.twoFactorEnabled,
    enrolled: user.twoFactorEnabled,
    // A pending (unconfirmed) secret exists while setup is in progress.
    pending: Boolean(user.twoFactorSecret) && !user.twoFactorEnabled,
    recoveryCodesRemaining: Array.isArray(user.twoFactorRecovery)
      ? (user.twoFactorRecovery as unknown[]).length
      : 0,
  };
}

/** Replace all recovery codes with a fresh set. */
export async function regenerateRecoveryCodes(authUser: AuthUser): Promise<{ recoveryCodes: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, branchId: true, twoFactorEnabled: true },
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  if (!user.twoFactorEnabled) {
    throw new BusinessRuleError("Enable two-factor authentication before generating recovery codes");
  }
  const { plain, hashes } = await createRecoveryCodes(8, (p) =>
    bcrypt.hash(p, config.bcryptSaltRounds),
  );
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorRecovery: hashes },
  });
  await writeAuditLog({
    module: "SECURITY",
    action: "TWO_FACTOR_RECOVERY_REGENERATED",
    tableName: "User",
    recordId: String(user.id),
    user: authUser,
    branchId: user.branchId,
    always: true,
  });
  return { recoveryCodes: plain };
}