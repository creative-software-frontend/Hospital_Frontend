// backend/src/modules/auth/securityPolicy.ts
// Central, live security policy reader plus the pure decision functions that
// enforce it. Every rule the Settings -> Security page exposes is enforced
// here so the UI can never be "another decorative toggle".
//
// Design rules:
//  - Pure functions take plain values so they are unit-testable without a DB.
//  - DB access is confined to `getSecurityPolicy()` and is cached briefly to
//    keep login fast while still picking up changes within a few seconds.

import { prisma } from "../../lib/prisma";

export interface SecurityPolicy {
  passwordMinLength: number;
  passwordExpiryDays: number;
  maxLoginAttempts: number;
  sessionTimeout: number;
  twoFactorEnabled: boolean;
  ipRestrictionEnabled: boolean;
  deviceRestrictionEnabled: boolean;
  auditLogEnabled: boolean;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  passwordHistoryCount: number;
  lockoutDurationMinutes: number;
  allowedIpRanges: string[];
  maxConcurrentSessions: number;
}

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  passwordMinLength: 8,
  passwordExpiryDays: 90,
  maxLoginAttempts: 5,
  sessionTimeout: 30,
  twoFactorEnabled: false,
  ipRestrictionEnabled: false,
  deviceRestrictionEnabled: false,
  auditLogEnabled: true,
  passwordRequireUppercase: false,
  passwordRequireLowercase: true,
  passwordRequireNumber: true,
  passwordRequireSymbol: false,
  passwordHistoryCount: 0,
  lockoutDurationMinutes: 15,
  allowedIpRanges: [],
  maxConcurrentSessions: 3,
};

let cached: { policy: SecurityPolicy; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5_000;

/** Parse the comma-separated allow-list into normalized CIDR/IP entries. */
export function parseAllowedIpRanges(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Read the effective policy from SecuritySetting (cached for a few seconds). */
export async function getSecurityPolicy(): Promise<SecurityPolicy> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.policy;
  }
  const setting = await prisma.securitySetting.findFirst({ orderBy: { id: "asc" } });
  const policy: SecurityPolicy = {
    passwordMinLength: setting?.passwordMinLength ?? DEFAULT_SECURITY_POLICY.passwordMinLength,
    passwordExpiryDays: setting?.passwordExpiryDays ?? DEFAULT_SECURITY_POLICY.passwordExpiryDays,
    maxLoginAttempts: setting?.maxLoginAttempts ?? DEFAULT_SECURITY_POLICY.maxLoginAttempts,
    sessionTimeout: setting?.sessionTimeout ?? DEFAULT_SECURITY_POLICY.sessionTimeout,
    twoFactorEnabled: setting?.twoFactorEnabled ?? false,
    ipRestrictionEnabled: setting?.ipRestrictionEnabled ?? false,
    deviceRestrictionEnabled: setting?.deviceRestrictionEnabled ?? false,
    auditLogEnabled: setting?.auditLogEnabled ?? true,
    passwordRequireUppercase: setting?.passwordRequireUppercase ?? false,
    passwordRequireLowercase: setting?.passwordRequireLowercase ?? true,
    passwordRequireNumber: setting?.passwordRequireNumber ?? true,
    passwordRequireSymbol: setting?.passwordRequireSymbol ?? false,
    passwordHistoryCount: setting?.passwordHistoryCount ?? 0,
    lockoutDurationMinutes:
      setting?.lockoutDurationMinutes ?? DEFAULT_SECURITY_POLICY.lockoutDurationMinutes,
    allowedIpRanges: parseAllowedIpRanges(setting?.allowedIpRanges),
    maxConcurrentSessions:
      setting?.maxConcurrentSessions ?? DEFAULT_SECURITY_POLICY.maxConcurrentSessions,
  };
  cached = { policy, expiresAt: now + CACHE_TTL_MS };
  return policy;
}

/** Drop the cache (called after the settings are updated). */
export function invalidateSecurityPolicyCache(): void {
  cached = null;
}

/* ------------------------------------------------------------------ *
 * Password rules
 * ------------------------------------------------------------------ */

/**
 * Validate a password against the live policy. Returns every failing rule so
 * the UI can show a complete list rather than one rule at a time.
 */
export function validatePasswordStrength(
  password: string,
  policy: Pick<
    SecurityPolicy,
    | "passwordMinLength"
    | "passwordRequireUppercase"
    | "passwordRequireLowercase"
    | "passwordRequireNumber"
    | "passwordRequireSymbol"
  >,
): string[] {
  const failures: string[] = [];
  if (password.length < policy.passwordMinLength) {
    failures.push(`Password must be at least ${policy.passwordMinLength} characters`);
  }
  if (policy.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    failures.push("Password must contain at least one uppercase letter");
  }
  if (policy.passwordRequireLowercase && !/[a-z]/.test(password)) {
    failures.push("Password must contain at least one lowercase letter");
  }
  if (policy.passwordRequireNumber && !/[0-9]/.test(password)) {
    failures.push("Password must contain at least one number");
  }
  if (policy.passwordRequireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    failures.push("Password must contain at least one special character");
  }
  return failures;
}

/** Has the password aged past passwordExpiryDays? 0 = never expires. */
export function isPasswordExpired(
  passwordChangedAt: Date | null | undefined,
  expiryDays: number,
  now: Date = new Date(),
): boolean {
  if (!expiryDays || expiryDays <= 0) return false;
  if (!passwordChangedAt) return true;
  const ageMs = now.getTime() - new Date(passwordChangedAt).getTime();
  return ageMs >= expiryDays * 24 * 60 * 60 * 1000;
}

/* ------------------------------------------------------------------ *
 * Brute-force / lockout
 * ------------------------------------------------------------------ */

/** Has the account exceeded maxLoginAttempts and is the lock still active? */
export function isLockedOut(
  state: { failedLoginAttempts: number; lockedUntil: Date | null | undefined },
  policy: Pick<SecurityPolicy, "maxLoginAttempts" | "lockoutDurationMinutes">,
  now: Date = new Date(),
): boolean {
  if (!state.lockedUntil) return false;
  const until = new Date(state.lockedUntil);
  if (until.getTime() <= now.getTime()) {
    return false;
  }
  return state.failedLoginAttempts >= policy.maxLoginAttempts;
}

/** Minutes an account stays locked once the attempt limit is hit. */
export function lockoutMinutes(policy: Pick<SecurityPolicy, "lockoutDurationMinutes">): number {
  return policy.lockoutDurationMinutes > 0 ? policy.lockoutDurationMinutes : 15;
}

/**
 * What the lock state becomes after one more failed attempt: either the
 * counter increments, or the account becomes locked for lockoutDurationMinutes.
 */
export function nextFailureState(
  state: { failedLoginAttempts: number },
  policy: Pick<SecurityPolicy, "maxLoginAttempts" | "lockoutDurationMinutes">,
  now: Date = new Date(),
): { failedLoginAttempts: number; lockedUntil: Date | null; lockoutTriggered: boolean } {
  const attempts = state.failedLoginAttempts + 1;
  if (attempts >= policy.maxLoginAttempts) {
    return {
      failedLoginAttempts: attempts,
      lockedUntil: new Date(now.getTime() + lockoutMinutes(policy) * 60 * 1000),
      lockoutTriggered: true,
    };
  }
  return { failedLoginAttempts: attempts, lockedUntil: null, lockoutTriggered: false };
}

/* ------------------------------------------------------------------ *
 * IP allow-list (CIDR aware, IPv4 + IPv6 loopback)
 * ------------------------------------------------------------------ */

function ipToBytes(ip: string): Uint8Array | null {
  const clean = ip.trim().replace(/^::ffff:/, "");
  const v4 = clean.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((p) => Number.isNaN(p) || p > 255)) return null;
    return new Uint8Array(parts);
  }
  if (clean.includes(":")) {
    // Expand a (possibly compressed) IPv6 address into 16 bytes.
    const [head, tail] = clean.split("::");
    const headParts = head ? head.split(":").filter(Boolean) : [];
    const tailParts = tail ? tail.split(":").filter(Boolean) : [];
    const total = headParts.length + tailParts.length;
    if (tail === undefined && total !== 8) return null;
    if (tail !== undefined && total > 7) return null;
    const middle = new Array(8 - total).fill("0");
    const parts = [...headParts, ...middle, ...tailParts];
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 8; i++) {
      const word = parseInt(parts[i] || "0", 16);
      if (Number.isNaN(word)) return null;
      bytes[i * 2] = (word >> 8) & 0xff;
      bytes[i * 2 + 1] = word & 0xff;
    }
    return bytes;
  }
  return null;
}

/** Is `ip` inside `cidr` (plain IP means /32 or /128)? */
export function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split("/");
  const ipBytes = ipToBytes(ip);
  const rangeBytes = ipToBytes(range);
  if (!ipBytes || !rangeBytes || ipBytes.length !== rangeBytes.length) return false;
  let prefix: number;
  if (bitsRaw === undefined) {
    prefix = ipBytes.length * 8;
  } else {
    prefix = Number(bitsRaw);
    if (Number.isNaN(prefix) || prefix < 0 || prefix > ipBytes.length * 8) return false;
  }
  const fullBytes = Math.floor(prefix / 8);
  for (let i = 0; i < fullBytes; i++) {
    if (ipBytes[i] !== rangeBytes[i]) return false;
  }
  const remainder = prefix % 8;
  if (remainder !== 0) {
    const mask = (0xff << (8 - remainder)) & 0xff;
    if ((ipBytes[fullBytes] & mask) !== (rangeBytes[fullBytes] & mask)) return false;
  }
  return true;
}

/**
 * Is this request allowed by the IP restriction? When the toggle is off every
 * address is allowed. When it is on, an empty allow-list blocks everyone
 * (fail closed) so enabling it without configuring ranges cannot silently
 * lock the hospital out in an unsafe way... except that would lock everyone
 * out entirely, so the admin must configure ranges first.
 */
export function isIpAllowed(
  ip: string | null | undefined,
  policy: Pick<SecurityPolicy, "ipRestrictionEnabled" | "allowedIpRanges">,
): { allowed: boolean; reason?: string } {
  if (!policy.ipRestrictionEnabled) return { allowed: true };
  if (!ip) return { allowed: false, reason: "IP address could not be determined" };
  if (policy.allowedIpRanges.length === 0) {
    return {
      allowed: false,
      reason: "IP restriction is enabled but no allowed IP ranges are configured",
    };
  }
  const allowed = policy.allowedIpRanges.some((cidr) => ipInCidr(ip, cidr));
  return allowed ? { allowed: true } : { allowed: false, reason: "IP address is not in the allow-list" };
}

/* ------------------------------------------------------------------ *
 * Session timeout / device restriction
 * ------------------------------------------------------------------ */

/** Absolute expiry for a session = now + sessionTimeout minutes. */
export function sessionExpiry(sessionTimeoutMinutes: number, now: Date = new Date()): Date {
  const minutes = sessionTimeoutMinutes > 0 ? sessionTimeoutMinutes : 30;
  return new Date(now.getTime() + minutes * 60 * 1000);
}

/** Is this session past its absolute expiry? */
export function isSessionExpired(
  session: { expiresAt: Date | string; revokedAt?: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (session.revokedAt) return true;
  return new Date(session.expiresAt).getTime() <= now.getTime();
}

/**
 * Should a new login be refused because the user already has the maximum
 * number of active sessions (device restriction)?
 */
export function isDeviceLimitReached(
  activeSessionCount: number,
  policy: Pick<SecurityPolicy, "deviceRestrictionEnabled" | "maxConcurrentSessions">,
): { blocked: boolean; reason?: string } {
  if (!policy.deviceRestrictionEnabled) return { blocked: false };
  const max = policy.maxConcurrentSessions > 0 ? policy.maxConcurrentSessions : 1;
  if (activeSessionCount >= max) {
    return {
      blocked: true,
      reason: `Device limit reached (${max} active session${max === 1 ? "" : "s"}). Sign out another device or ask an administrator.`,
    };
  }
  return { blocked: false };
}

/**
 * Should this user be challenged for a second factor? The global toggle must
 * be on AND the user must have completed enrollment.
 */
export function requiresTwoFactor(
  user: { twoFactorEnabled: boolean },
  policy: Pick<SecurityPolicy, "twoFactorEnabled">,
): boolean {
  return policy.twoFactorEnabled && user.twoFactorEnabled;
}