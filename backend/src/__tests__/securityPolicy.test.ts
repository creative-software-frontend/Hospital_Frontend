import { describe, it, expect } from "vitest";
import {
  DEFAULT_SECURITY_POLICY,
  ipInCidr,
  isDeviceLimitReached,
  isIpAllowed,
  isLockedOut,
  isPasswordExpired,
  isSessionExpired,
  nextFailureState,
  parseAllowedIpRanges,
  requiresTwoFactor,
  sessionExpiry,
  validatePasswordStrength,
} from "../modules/auth/securityPolicy";

const policy = DEFAULT_SECURITY_POLICY;

/* ------------------------------------------------------------------ *
 * Password complexity
 * ------------------------------------------------------------------ */
describe("validatePasswordStrength", () => {
  it("accepts a password that satisfies every enabled rule", () => {
    expect(validatePasswordStrength("Passw0rd!", { ...policy, passwordRequireSymbol: true })).toEqual(
      [],
    );
  });

  it("reports every failing rule at once so the UI can show a full list", () => {
    const failures = validatePasswordStrength("abc", {
      passwordMinLength: 8,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumber: true,
      passwordRequireSymbol: true,
    });
    expect(failures).toHaveLength(4);
    expect(failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("at least 8"),
        expect.stringContaining("uppercase"),
        expect.stringContaining("number"),
        expect.stringContaining("special"),
      ]),
    );
    expect(failures).not.toEqual(expect.arrayContaining([expect.stringContaining("lowercase")]));
  });

  it("honours a raised minimum length", () => {
    expect(validatePasswordStrength("Passw0rd", { ...policy, passwordMinLength: 12 })).toEqual([
      "Password must be at least 12 characters",
    ]);
  });

  it("treats a space as a special character", () => {
    expect(validatePasswordStrength("Passw0rd ", { ...policy, passwordRequireSymbol: true })).toEqual(
      [],
    );
  });
});

/* ------------------------------------------------------------------ *
 * Password expiry
 * ------------------------------------------------------------------ */
describe("isPasswordExpired", () => {
  const now = new Date("2026-10-05T12:00:00.000Z");

  it("never expires when expiry is disabled (0)", () => {
    expect(isPasswordExpired(new Date("2020-01-01"), 0, now)).toBe(false);
  });

  it("treats a missing passwordChangedAt as expired", () => {
    expect(isPasswordExpired(null, 90, now)).toBe(true);
  });

  it("is not expired before the window closes", () => {
    expect(isPasswordExpired(new Date("2026-10-01T12:00:00.000Z"), 90, now)).toBe(false);
  });

  it("is expired exactly on the boundary", () => {
    const changed = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    expect(isPasswordExpired(changed, 90, now)).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * Lockout
 * ------------------------------------------------------------------ */
describe("isLockedOut", () => {
  const lockPolicy = { maxLoginAttempts: 3, lockoutDurationMinutes: 15 };
  const now = new Date("2026-10-05T12:00:00.000Z");

  it("is not locked before any failure", () => {
    expect(isLockedOut({ failedLoginAttempts: 0, lockedUntil: null }, lockPolicy, now)).toBe(false);
  });

  it("is locked once the limit is reached and the window is open", () => {
    const lockedUntil = new Date(now.getTime() + 5 * 60 * 1000);
    expect(isLockedOut({ failedLoginAttempts: 3, lockedUntil }, lockPolicy, now)).toBe(true);
  });

  it("stays locked when attempts exceed the limit", () => {
    const lockedUntil = new Date(now.getTime() + 5 * 60 * 1000);
    expect(isLockedOut({ failedLoginAttempts: 7, lockedUntil }, lockPolicy, now)).toBe(true);
  });

  it("unlocks automatically once the window passes", () => {
    const lockedUntil = new Date(now.getTime() - 1000);
    expect(isLockedOut({ failedLoginAttempts: 9, lockedUntil }, lockPolicy, now)).toBe(false);
  });
});

describe("nextFailureState", () => {
  const lockPolicy = { maxLoginAttempts: 3, lockoutDurationMinutes: 15 };
  const now = new Date("2026-10-05T12:00:00.000Z");

  it("increments the counter below the limit without locking", () => {
    expect(nextFailureState({ failedLoginAttempts: 0 }, lockPolicy, now)).toEqual({
      failedLoginAttempts: 1,
      lockedUntil: null,
      lockoutTriggered: false,
    });
  });

  it("locks exactly on the Nth failure", () => {
    const result = nextFailureState({ failedLoginAttempts: 2 }, lockPolicy, now);
    expect(result.failedLoginAttempts).toBe(3);
    expect(result.lockoutTriggered).toBe(true);
    expect(result.lockedUntil?.getTime()).toBe(now.getTime() + 15 * 60 * 1000);
  });

  it("keeps the lock while failures continue", () => {
    const result = nextFailureState({ failedLoginAttempts: 5 }, lockPolicy, now);
    expect(result.lockoutTriggered).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * IP allow-list
 * ------------------------------------------------------------------ */
describe("parseAllowedIpRanges", () => {
  it("splits on commas and whitespace and drops blanks", () => {
    expect(parseAllowedIpRanges("10.0.0.0/8, 192.168.1.1 ,,127.0.0.1")).toEqual([
      "10.0.0.0/8",
      "192.168.1.1",
      "127.0.0.1",
    ]);
  });

  it("returns an empty list for null/empty input", () => {
    expect(parseAllowedIpRanges(null)).toEqual([]);
    expect(parseAllowedIpRanges("   ")).toEqual([]);
  });
});

describe("ipInCidr", () => {
  it("matches a /24 subnet", () => {
    expect(ipInCidr("10.0.0.5", "10.0.0.0/24")).toBe(true);
    expect(ipInCidr("10.0.1.5", "10.0.0.0/24")).toBe(false);
  });

  it("treats a bare IP as a host match", () => {
    expect(ipInCidr("192.168.1.10", "192.168.1.10")).toBe(true);
    expect(ipInCidr("192.168.1.11", "192.168.1.10")).toBe(false);
  });

  it("matches the whole /8 and /0 extremes", () => {
    expect(ipInCidr("203.0.113.9", "0.0.0.0/0")).toBe(true);
    expect(ipInCidr("203.0.113.9", "203.0.0.0/8")).toBe(true);
    expect(ipInCidr("204.0.113.9", "203.0.0.0/8")).toBe(false);
  });

  it("honours a non-byte-aligned prefix (/12)", () => {
    expect(ipInCidr("10.10.0.1", "10.0.0.0/8")).toBe(true);
    expect(ipInCidr("11.0.0.1", "10.0.0.0/8")).toBe(false);
  });

  it("normalizes IPv4-mapped IPv6 loopback", () => {
    expect(ipInCidr("::ffff:127.0.0.1", "127.0.0.1")).toBe(true);
  });

  it("supports IPv6 loopback and /64", () => {
    expect(ipInCidr("::1", "::1/128")).toBe(true);
    expect(ipInCidr("2001:db8::1", "2001:db8::/32")).toBe(true);
    expect(ipInCidr("2001:db9::1", "2001:db8::/32")).toBe(false);
  });

  it("rejects malformed input instead of throwing", () => {
    expect(ipInCidr("999.1.1.1", "10.0.0.0/8")).toBe(false);
    expect(ipInCidr("not-an-ip", "10.0.0.0/8")).toBe(false);
    expect(ipInCidr("10.0.0.1", "10.0.0.0/33")).toBe(false);
  });

  it("does not compare across address families", () => {
    expect(ipInCidr("10.0.0.1", "::1/128")).toBe(false);
  });
});

describe("isIpAllowed", () => {
  it("allows everything when the restriction is off", () => {
    expect(isIpAllowed("8.8.8.8", { ipRestrictionEnabled: false, allowedIpRanges: [] })).toEqual({
      allowed: true,
    });
  });

  it("blocks everyone when enabled with no ranges (fails closed)", () => {
    const result = isIpAllowed("10.0.0.1", { ipRestrictionEnabled: true, allowedIpRanges: [] });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/no allowed IP ranges/i);
  });

  it("blocks when the request IP is unknown", () => {
    const result = isIpAllowed(undefined, {
      ipRestrictionEnabled: true,
      allowedIpRanges: ["10.0.0.0/8"],
    });
    expect(result.allowed).toBe(false);
  });

  it("allows an address inside any configured range", () => {
    expect(
      isIpAllowed("10.5.6.7", { ipRestrictionEnabled: true, allowedIpRanges: ["10.0.0.0/8"] }),
    ).toEqual({ allowed: true });
  });

  it("blocks an address outside every configured range", () => {
    const result = isIpAllowed("8.8.8.8", {
      ipRestrictionEnabled: true,
      allowedIpRanges: ["10.0.0.0/8", "127.0.0.1"],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not in the allow-list/i);
  });
});

/* ------------------------------------------------------------------ *
 * Sessions / devices
 * ------------------------------------------------------------------ */
describe("sessionExpiry / isSessionExpired", () => {
  const now = new Date("2026-10-05T12:00:00.000Z");

  it("expires the session exactly sessionTimeout minutes out", () => {
    expect(sessionExpiry(30, now).getTime()).toBe(now.getTime() + 30 * 60 * 1000);
  });

  it("falls back to 30 minutes for a nonsensical value", () => {
    expect(sessionExpiry(0, now).getTime()).toBe(now.getTime() + 30 * 60 * 1000);
  });

  it("reports expiry on the boundary", () => {
    expect(isSessionExpired({ expiresAt: new Date(now.getTime()) }, now)).toBe(true);
  });

  it("is valid before expiry", () => {
    expect(isSessionExpired({ expiresAt: new Date(now.getTime() + 1000) }, now)).toBe(false);
  });

  it("treats a revoked session as expired regardless of time", () => {
    expect(
      isSessionExpired({ expiresAt: new Date(now.getTime() + 60_000), revokedAt: now }, now),
    ).toBe(true);
  });
});

describe("isDeviceLimitReached", () => {
  it("is unlimited while the toggle is off", () => {
    expect(isDeviceLimitReached(99, { deviceRestrictionEnabled: false, maxConcurrentSessions: 1 })).toEqual(
      { blocked: false },
    );
  });

  it("allows a login below the limit", () => {
    expect(
      isDeviceLimitReached(1, { deviceRestrictionEnabled: true, maxConcurrentSessions: 3 }),
    ).toEqual({ blocked: false });
  });

  it("blocks at the limit and names it in the reason", () => {
    const result = isDeviceLimitReached(3, { deviceRestrictionEnabled: true, maxConcurrentSessions: 3 });
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("3 active sessions");
  });

  it("treats a nonsensical limit as single-session", () => {
    expect(
      isDeviceLimitReached(1, { deviceRestrictionEnabled: true, maxConcurrentSessions: 0 }).blocked,
    ).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * Two-factor gate
 * ------------------------------------------------------------------ */
describe("requiresTwoFactor", () => {
  it("challenges only when global 2FA is on AND the user enrolled", () => {
    expect(requiresTwoFactor({ twoFactorEnabled: true }, { twoFactorEnabled: true })).toBe(true);
    expect(requiresTwoFactor({ twoFactorEnabled: false }, { twoFactorEnabled: true })).toBe(false);
    expect(requiresTwoFactor({ twoFactorEnabled: true }, { twoFactorEnabled: false })).toBe(false);
  });
});