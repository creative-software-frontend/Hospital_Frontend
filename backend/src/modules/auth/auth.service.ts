// backend/src/modules/auth/auth.service.ts
// Authentication with every Settings -> Security control actually enforced:
//   * maxLoginAttempts + lockoutDurationMinutes -> brute-force lockout
//   * sessionTimeout                             -> real session expiry + idle sliding
//   * passwordExpiryDays                         -> forced password change
//   * twoFactorEnabled                           -> TOTP / recovery-code challenge
//   * ipRestrictionEnabled + allowedIpRanges      -> CIDR allow-list
//   * deviceRestrictionEnabled + maxConcurrentSessions -> device cap
//   * auditLogEnabled                            -> honors the toggle (except AUTH/SECURITY)
//   * full password policy + history             -> enforced on every write
//
// Every decision is recorded in LoginAttempt and mirrored to the audit log.

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
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
import type {
  AdminResetPasswordInput,
  ChangePasswordInput,
  LoginInput,
  TwoFactorDisableInput,
} from "./auth.validation";
import {
  getSecurityPolicy,
  isDeviceLimitReached,
  isIpAllowed,
  isLockedOut,
  isPasswordExpired,
  isSessionExpired,
  nextFailureState,
  requiresTwoFactor,
  sessionExpiry,
  validatePasswordStrength,
  type SecurityPolicy,
} from "./securityPolicy";
import { consumeRecoveryCode, verifyTotp } from "./twoFactor";

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
  /** Effective session lifetime in milliseconds, for the cookie. */
  sessionMaxAgeMs: number;
  /** True when the user must set a new password before doing anything else. */
  mustChangePassword: boolean;
}

export interface SafeUser {
  id: number;
  email: string;
  username: string | null;
  name: string;
  status: string;
  branchId: number;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
}

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

/** Record every attempt so lockouts are auditable and testable. */
async function recordAttempt(params: {
  userId: number | null;
  identifier: string;
  success: boolean;
  reason: string;
  meta: RequestMeta;
}): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        userId: params.userId,
        identifier: params.identifier.slice(0, 191),
        success: params.success,
        reason: params.reason,
        ipAddress: params.meta.ip ?? null,
        userAgent: params.meta.userAgent?.slice(0, 191) ?? null,
      },
    });
  } catch {
    // Never let bookkeeping break authentication.
  }
}

/** Stable, non-reversible device fingerprint for device accounting. */
function deviceFingerprint(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  return crypto.createHash("sha256").update(userAgent).digest("hex").slice(0, 32);
}

/**
 * True when maintenance mode is active for everyone except users whose roles
 * hold the `systemMaintenance:update` permission. The bypass exists so whoever
 * can turn maintenance mode off is always able to sign in and do so â€” without
 * it, one toggle could lock the entire installation out.
 */
async function maintenanceBlocksSignIn(user: {
  userRoles: Array<{ role: { id: number } }>;
}): Promise<boolean> {
  const record = await prisma.systemMaintenance.findFirst({
    select: { maintenanceMode: true },
  });
  if (!record?.maintenanceMode) return false;

  const roleIds = user.userRoles.map((ur) => ur.role.id);
  if (roleIds.length === 0) return true;
  const bypass = await prisma.rolePermission.count({
    where: {
      roleId: { in: roleIds },
      permission: { module: "systemMaintenance", action: "update" },
    },
  });
  return bypass === 0;
}

async function getUserWithRoles(identifier: string) {
  return prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      password: true,
      status: true,
      branchId: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      lastFailedLoginAt: true,
      passwordChangedAt: true,
      mustChangePassword: true,
      passwordHistory: true,
      twoFactorSecret: true,
      twoFactorEnabled: true,
      twoFactorRecovery: true,
      tokenVersion: true,
      branch: { select: { id: true, name: true, code: true } },
      userRoles: {
        select: { role: { select: { id: true, seederKey: true, name: true } } },
      },
    },
  });
}

export async function login(input: LoginInput, meta: RequestMeta = {}): Promise<LoginResult> {
  const identifier = input.identifier.trim();
  const policy = await getSecurityPolicy();

  // 1. IP restriction applies before anything else, so a blocked network can
  //    never probe credentials.
  const ipCheck = isIpAllowed(meta.ip, policy);
  if (!ipCheck.allowed) {
    await recordAttempt({
      userId: null,
      identifier,
      success: false,
      reason: "IP_BLOCKED",
      meta,
    });
    await writeAuditLog({
      module: "AUTH",
      action: "LOGIN_BLOCKED_IP",
      user: null,
      branchId: 0,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      newValues: { identifier, reason: ipCheck.reason },
      always: true,
    });
    throw new AuthenticationError(ipCheck.reason ?? "Access denied from this network");
  }

  const user = await getUserWithRoles(identifier);

  if (!user) {
    await recordAttempt({ userId: null, identifier, success: false, reason: "BAD_PASSWORD", meta });
    // Generic failure so the API does not reveal whether the identifier exists.
    throw new AuthenticationError(INVALID_CREDENTIALS);
  }

  // 2. Lockout is checked before the password comparison so a locked account
  //    cannot be brute-forced while its lock is active.
  if (isLockedOut(user, policy)) {
    await recordAttempt({ userId: user.id, identifier, success: false, reason: "LOCKED", meta });
    await writeAuditLog({
      module: "AUTH",
      action: "LOGIN_BLOCKED_LOCKED",
      tableName: "User",
      recordId: String(user.id),
      user: userToAuth(user),
      branchId: user.branchId,
      ipAddress: meta.ip,
      always: true,
    });
    const minutes = Math.max(
      1,
      Math.ceil((new Date(user.lockedUntil!).getTime() - Date.now()) / 60000),
    );
    throw new AuthenticationError(
      `Account is temporarily locked after ${policy.maxLoginAttempts} failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    );
  }

  // An expired lock starts a clean slate.
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() <= Date.now()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
  }

  if (user.status !== "ACTIVE") {
    await recordAttempt({ userId: user.id, identifier, success: false, reason: "DISABLED", meta });
    await writeAuditLog({
      module: "AUTH",
      action: "LOGIN_BLOCKED",
      user: userToAuth(user),
      branchId: user.branchId,
      ipAddress: meta.ip,
      always: true,
    });
    throw new AuthenticationError(
      user.status === "LOCKED" ? "Account is locked" : "Account is not active",
    );
  }

  // 3. Maintenance mode restricts new sign-ins to privileged users, BEFORE the
  //    password check, so a blocked network probe cannot learn whether
  //    maintenance is on by observing which message it gets back.
  if (await maintenanceBlocksSignIn(user)) {
    await recordAttempt({
      userId: user.id,
      identifier,
      success: false,
      reason: "MAINTENANCE_MODE",
      meta,
    });
    await writeAuditLog({
      module: "AUTH",
      action: "LOGIN_BLOCKED_MAINTENANCE",
      tableName: "User",
      recordId: String(user.id),
      user: userToAuth(user),
      branchId: user.branchId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      always: true,
    });
    throw new AuthenticationError(
      "System is currently in maintenance mode. Please contact your administrator or try again later.",
    );
  }

  // 4. Password.
  const passwordMatches = await bcrypt.compare(input.password, user.password);
  if (!passwordMatches) {
    const next = nextFailureState(
      { failedLoginAttempts: user.failedLoginAttempts },
      policy,
    );
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: next.failedLoginAttempts,
        lockedUntil: next.lockedUntil,
        lastFailedLoginAt: new Date(),
      },
    });
    await recordAttempt({
      userId: user.id,
      identifier,
      success: false,
      reason: "BAD_PASSWORD",
      meta,
    });
    await writeAuditLog({
      module: "AUTH",
      action: "LOGIN_FAILED",
      tableName: "User",
      recordId: String(user.id),
      user: userToAuth(user),
      branchId: user.branchId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      newValues: {
        failedLoginAttempts: next.failedLoginAttempts,
        locked: next.lockoutTriggered,
      },
      always: true,
    });
    if (next.lockoutTriggered) {
      throw new AuthenticationError(
        `Account locked after ${policy.maxLoginAttempts} failed attempts. Try again in ${policy.lockoutDurationMinutes} minutes.`,
      );
    }
    const remaining = policy.maxLoginAttempts - next.failedLoginAttempts;
    throw new AuthenticationError(
      `${INVALID_CREDENTIALS}. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before the account is locked.`,
    );
  }

  // 5. Second factor.
  let usedRecovery = false;
  if (requiresTwoFactor(user, policy)) {
    const secret = user.twoFactorSecret ?? "";
    let twoFactorOk = false;
    let remainingRecovery: string[] = [];

    if (input.twoFactorCode && secret) {
      twoFactorOk = verifyTotp(secret, input.twoFactorCode);
    }
    if (!twoFactorOk && input.recoveryCode) {
      const result = await consumeRecoveryCode(
        input.recoveryCode,
        user.twoFactorRecovery,
        (plain, hash) => bcrypt.compare(plain, hash),
      );
      twoFactorOk = result.matched;
      usedRecovery = result.matched;
      remainingRecovery = result.remaining;
    }

    if (!twoFactorOk) {
      await recordAttempt({
        userId: user.id,
        identifier,
        success: false,
        reason: "TWO_FACTOR_FAILED",
        meta,
      });
      await writeAuditLog({
        module: "AUTH",
        action: "LOGIN_FAILED_2FA",
        tableName: "User",
        recordId: String(user.id),
        user: userToAuth(user),
        branchId: user.branchId,
        ipAddress: meta.ip,
        always: true,
      });
      throw new AuthenticationError(
        "A valid two-factor code or recovery code is required",
      );
    }
    if (usedRecovery) {
      // Recovery codes are single use.
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorRecovery: remainingRecovery },
      });
    }
  }

  // 6. Device restriction.
  const deviceId = deviceFingerprint(meta.userAgent);
  const now = new Date();
  const activeSessions = await prisma.userSession.count({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: now } },
  });
  const deviceCheck = isDeviceLimitReached(activeSessions, policy);
  if (deviceCheck.blocked) {
    await recordAttempt({
      userId: user.id,
      identifier,
      success: false,
      reason: "DEVICE_BLOCKED",
      meta,
    });
    await writeAuditLog({
      module: "AUTH",
      action: "LOGIN_BLOCKED_DEVICE",
      tableName: "User",
      recordId: String(user.id),
      user: userToAuth(user),
      branchId: user.branchId,
      ipAddress: meta.ip,
      always: true,
    });
    throw new AuthenticationError(deviceCheck.reason ?? "Device limit reached");
  }

  // 7. Password expiry forces a change but still lets the user sign in enough
  //    to perform it.
  const expired = isPasswordExpired(user.passwordChangedAt, policy.passwordExpiryDays, now);
  const mustChangePassword = user.mustChangePassword || expired;

  // 8. Create the server-side session. Its expiry IS the session timeout.
  const expiresAt = sessionExpiry(policy.sessionTimeout, now);
  const jti = crypto.randomUUID();

  await prisma.userSession.create({
    data: {
      userId: user.id,
      tokenId: jti,
      ipAddress: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 191) ?? null,
      deviceId,
      lastSeenAt: now,
      expiresAt,
    },
  });

  // Successful login clears the failure counter and records the sign-in.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: now,
      failedLoginAttempts: 0,
      lockedUntil: null,
      mustChangePassword,
    },
  });

  await recordAttempt({ userId: user.id, identifier, success: true, reason: "OK", meta });

  const roles = user.userRoles.map((ur) => ur.role.seederKey);
  const accessToken = signAccessToken(
    {
      sub: String(user.id),
      email: user.email,
      name: user.name,
      jti,
      tv: user.tokenVersion,
    },
    policy.sessionTimeout,
  );

  await writeAuditLog({
    module: "AUTH",
    action: "LOGIN_SUCCESS",
    tableName: "User",
    recordId: String(user.id),
    user: userToAuth(user),
    branchId: user.branchId,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
    newValues: {
      sessionExpiresAt: expiresAt.toISOString(),
      mustChangePassword,
      usedRecoveryCode: usedRecovery,
    },
    always: true,
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
    sessionMaxAgeMs: expiresAt.getTime() - now.getTime(),
    mustChangePassword,
  };
}

/**
 * Validates a session for an authenticated request: not revoked, not expired,
 * token version still current. Slides the idle window on activity so an active
 * user is not logged out mid-task, while an abandoned session dies on schedule.
 */
export async function assertSessionActive(params: {
  userId: number;
  tokenId: string;
  tokenVersion: number;
  /** When true the lastSeenAt window is not extended (e.g. token refresh). */
  touch?: boolean;
}): Promise<void> {
  const session = await prisma.userSession.findUnique({
    where: { tokenId: params.tokenId },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
    },
  });
  if (!session || session.userId !== params.userId) {
    throw new AuthenticationError("Session is no longer valid");
  }
  if (session.revokedAt) {
    throw new AuthenticationError("Session has been signed out");
  }
  const now = new Date();
  if (isSessionExpired(session, now)) {
    throw new AuthenticationError("Session expired, please sign in again");
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { tokenVersion: true },
  });
  if (!user || user.tokenVersion !== params.tokenVersion) {
    throw new AuthenticationError("Session is no longer valid");
  }

  // Slide the idle window at most once a minute to avoid a write per request.
  if (params.touch !== false && now.getTime() - new Date(session.lastSeenAt).getTime() > 60_000) {
    await prisma.userSession
      .update({ where: { id: session.id }, data: { lastSeenAt: now } })
      .catch(() => undefined);
  }
}

/** Revoke one session, or every session for the user when id is omitted. */
export async function revokeSessions(
  userId: number,
  opts: { sessionId?: number; reason?: string } = {},
): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(opts.sessionId ? { id: opts.sessionId } : {}),
    },
    data: { revokedAt: new Date(), revokedReason: opts.reason ?? "signed-out" },
  });
  return result.count;
}

/**
 * Revoke only the session that presented this access token.
 *
 * Signing out of one browser must not sign the user out of their phone, so this
 * is deliberately narrower than revokeSessions(), which is reserved for
 * password changes, administrative resets and the explicit "sign out
 * everywhere" control.
 */
export async function revokeSessionByToken(
  userId: number,
  tokenId: string,
  reason = "logout",
): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: { userId, tokenId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return result.count;
}

/** Active sessions for the account (used by the UI to show signed-in devices). */
export async function listActiveSessions(userId: number) {
  const now = new Date();
  const sessions = await prisma.userSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      deviceId: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });
  return sessions;
}

/** Recent login attempts for the current user (security review). */
export async function listLoginAttempts(userId: number, take = 20) {
  return prisma.loginAttempt.findMany({
    where: { userId },
    select: {
      id: true,
      success: true,
      reason: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/**
 * Loads the current user fresh from the database (never from JWT claims) so
 * that status/role changes take effect immediately.
 */
export async function getCurrentUser(
  userId: number,
): Promise<{ user: SafeUser; roles: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      status: true,
      branchId: true,
      mustChangePassword: true,
      twoFactorEnabled: true,
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
      mustChangePassword: user.mustChangePassword,
      twoFactorEnabled: user.twoFactorEnabled,
    },
    roles: user.userRoles.map((ur) => ur.role.seederKey),
  };
}

/* ------------------------------------------------------------------ *
 * Password lifecycle
 * ------------------------------------------------------------------ */

/**
 * The password rules as plain data, so any signed-in user (including one who
 * must change an expired password) can render a live checklist instead of
 * discovering the rules by trial and error. Contains no secrets.
 */
export async function getPasswordPolicyForUser(): Promise<{
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  historyCount: number;
  expiryDays: number;
}> {
  const p = await getSecurityPolicy();
  return {
    minLength: p.passwordMinLength,
    requireUppercase: p.passwordRequireUppercase,
    requireLowercase: p.passwordRequireLowercase,
    requireNumber: p.passwordRequireNumber,
    requireSymbol: p.passwordRequireSymbol,
    historyCount: p.passwordHistoryCount,
    expiryDays: p.passwordExpiryDays,
  };
}

/** Reject a password that breaks the live policy. */
export async function assertPasswordAcceptable(password: string): Promise<void> {
  const policy = await getSecurityPolicy();
  const failures = validatePasswordStrength(password, policy);
  if (failures.length > 0) {
    throw new BusinessRuleError(failures.join(". "), { password: failures.join(". ") });
  }
}

/**
 * Read a stored hash list from a Prisma `Json` column.
 *
 * Values written as JSON text (an older writer stored `JSON.stringify([...])`)
 * come back as a string rather than an array, which silently disabled the reuse
 * check, so both shapes are accepted here.
 */
export function toHashList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === "string");
      }
    } catch {
      return [];
    }
  }
  return [];
}

/** Reject reuse of any of the last `passwordHistoryCount` passwords. */
export async function assertPasswordNotReused(
  password: string,
  history: unknown,
  policy: Pick<SecurityPolicy, "passwordHistoryCount">,
): Promise<void> {
  if (!policy.passwordHistoryCount) return;
  const window = toHashList(history).slice(0, policy.passwordHistoryCount);
  for (const hash of window) {
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(password, hash)) {
      throw new BusinessRuleError(
        `You cannot reuse any of your last ${policy.passwordHistoryCount} passwords`,
        { password: "This password was used recently" },
      );
    }
  }
}

/**
 * Store a new password hash, maintaining the bounded password history and
 * clearing any forced-change flag.
 */
export async function persistNewPassword(params: {
  userId: string | number;
  newHash: string;
  policy: Pick<SecurityPolicy, "passwordHistoryCount">;
  /** Explicit flag: true forces a change at next sign-in, false clears it. */
  mustChangePassword?: boolean;
}): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { id: Number(params.userId) },
    select: { passwordHistory: true, password: true },
  });
  const previous = toHashList(existing?.passwordHistory);
  const keep = params.policy.passwordHistoryCount > 0 ? params.policy.passwordHistoryCount : 0;
  // The window holds the last N *superseded* hashes, newest first. The password
  // being replaced must enter it, otherwise the reuse check only ever sees the
  // current password and historyCount silently does nothing for anyone whose
  // history was not pre-seeded. The current hash is deliberately excluded: it is
  // already rejected by the "reuse of current password" check, so storing it
  // would consume one of the N allowed slots (making count=1 a no-op).
  const superseded = existing?.password;
  const candidates = [
    ...(superseded ? [superseded] : []),
    ...previous,
  ].filter((hash, index, all) => all.indexOf(hash) === index);
  const history = keep > 0 ? candidates.slice(0, keep) : [];

  await prisma.user.update({
    where: { id: Number(params.userId) },
    data: {
      password: params.newHash,
      passwordChangedAt: new Date(),
      // Json column: assign the array itself. Writing JSON.stringify(...) stores a
      // JSON *string*, which then reads back as a string and disables the reuse
      // check on the next attempt.
      passwordHistory: history,
      ...(params.mustChangePassword === undefined
        ? {}
        : { mustChangePassword: params.mustChangePassword }),
    },
  });
}

export async function changePassword(authUser: AuthUser, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      password: true,
      status: true,
      branchId: true,
      passwordHistory: true,
    },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new AuthenticationError("Account is not active");
  }

  const matches = await bcrypt.compare(input.currentPassword, user.password);
  if (!matches) {
    await writeAuditLog({
      module: "AUTH",
      action: "PASSWORD_CHANGE_FAILED",
      tableName: "User",
      recordId: String(user.id),
      user: authUser,
      branchId: user.branchId,
      always: true,
    });
    throw new AuthenticationError("Current password is incorrect");
  }

  const isSame = await bcrypt.compare(input.newPassword, user.password);
  if (isSame) {
    throw new BusinessRuleError("New password must be different from the current password");
  }

  const policy = await getSecurityPolicy();
  await assertPasswordAcceptable(input.newPassword);
  await assertPasswordNotReused(input.newPassword, user.passwordHistory, policy);

  const newHash = await bcrypt.hash(input.newPassword, config.bcryptSaltRounds);
  await persistNewPassword({
    userId: user.id,
    newHash,
    policy,
    mustChangePassword: false,
  });

  // A password change invalidates every session, including the one making the
  // request, so a stolen token cannot outlive the new password.
  await revokeSessions(user.id, { reason: "password-changed" });

  await writeAuditLog({
    module: "AUTH",
    action: "PASSWORD_CHANGED",
    tableName: "User",
    recordId: String(user.id),
    user: authUser,
    branchId: user.branchId,
    always: true,
  });
}

/**
 * Administrator-initiated reset. Enforces the same policy, marks the account as
 * needing a change, and revokes all sessions so the old password stops working
 * immediately.
 */
export async function adminResetPassword(
  actor: AuthUser,
  targetUserId: number,
  input: AdminResetPasswordInput,
): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, branchId: true, passwordHistory: true, password: true },
  });
  if (!target) {
    throw new NotFoundError("User not found");
  }

  const policy = await getSecurityPolicy();
  await assertPasswordAcceptable(input.newPassword);
  await assertPasswordNotReused(input.newPassword, target.passwordHistory, policy);

  const newHash = await bcrypt.hash(input.newPassword, config.bcryptSaltRounds);
  await persistNewPassword({
    userId: target.id,
    newHash,
    policy,
    mustChangePassword: input.requireChange ?? true,
  });

  await revokeSessions(target.id, { reason: "admin-password-reset" });

  await writeAuditLog({
    module: "SECURITY",
    action: "PASSWORD_RESET_BY_ADMIN",
    tableName: "User",
    recordId: String(target.id),
    user: actor,
    branchId: actor.branchId,
    newValues: { targetUserId: target.id, requireChange: input.requireChange ?? true },
    always: true,
  });
}

/**
 * Clear a lockout early and reset the failure counter.
 *
 * Only the lockout state is touched. A deliberate INACTIVE/SUSPENDED status is an
 * administrative decision that must survive an unlock, so it is preserved unless
 * the account is only "LOCKED" (a status the login flow sets from a lockout).
 */
export async function unlockUser(actor: AuthUser, targetUserId: number): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new NotFoundError("User not found");
  }
  if (existing.status !== "ACTIVE" && existing.status !== "LOCKED") {
    throw new BusinessRuleError(
      `Cannot unlock: this account is ${existing.status.toLowerCase()}. Activate it first.`
    );
  }

  const target = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      ...(existing.status === "LOCKED" ? { status: "ACTIVE" as const } : {}),
    },
    select: { id: true },
  });
  await writeAuditLog({
    module: "SECURITY",
    action: "ACCOUNT_UNLOCKED",
    tableName: "User",
    recordId: String(target.id),
    user: actor,
    branchId: actor.branchId,
    always: true,
  });
}

export async function logoutSuccess(authUser: AuthUser, tokenId?: string): Promise<void> {
  if (tokenId) {
    await revokeSessionByToken(authUser.id, tokenId, "logout");
  }
  await writeAuditLog({
    module: "AUTH",
    action: "LOGOUT",
    tableName: "User",
    recordId: String(authUser.id),
    user: authUser,
    branchId: authUser.branchId,
    always: true,
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
      failedLoginAttempts: true,
      lockedUntil: true,
      passwordChangedAt: true,
      mustChangePassword: true,
      twoFactorEnabled: true,
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