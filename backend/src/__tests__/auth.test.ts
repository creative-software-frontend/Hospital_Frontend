import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// Referenced by the $transaction mock below, which needs the mocked client.
let mockPrismaRef: unknown;

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    userSession: {
      create: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    loginAttempt: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    branch: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    role: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    userRole: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    securitySetting: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    systemMaintenance: {
      findFirst: vi.fn(),
    },
    rolePermission: {
      count: vi.fn(),
    },
    // Supports both the array-of-operations form and the interactive
    // callback form used by createUser.
    $transaction: vi.fn(async (arg: unknown) => {
      // Interactive form: hand the transaction client back to the callback.
      if (typeof arg === "function") return (arg as (tx: unknown) => Promise<unknown>)(mockPrismaRef);
      const results = [];
      for (const fn of arg as unknown[]) {
        if (typeof fn === "function") results.push(await (fn as () => Promise<unknown>)());
      }
      return results;
    }),
  },
}));

vi.mock("../utils/token", () => ({
  signAccessToken: vi.fn(() => "mock-jwt-token"),
  expiresInSeconds: vi.fn(() => 43200),
}));

vi.mock("../utils/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
  isCriticalAuditModule: vi.fn((m: string) => ["auth", "security"].includes(m.toLowerCase())),
}));

const mockPrisma = vi.mocked(await import("../lib/prisma")).prisma;
mockPrismaRef = mockPrisma;

// ----------------------------------------------------------------
import * as authService from "../modules/auth/auth.service";
import { assertPasswordNotReused } from "../modules/auth/auth.service";
import { invalidateSecurityPolicyCache } from "../modules/auth/securityPolicy";
import { hotp, totpCounter } from "../modules/auth/twoFactor";
import { writeAuditLog } from "../utils/audit";
import { signAccessToken } from "../utils/token";
import type { AuthUser } from "../types/auth";

const fn = () => mockPrisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const asMock = (obj: string, method: string) =>
  fn()[obj][method] as unknown as ReturnType<typeof vi.fn>;

const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const currentTotp = () => hotp(TOTP_SECRET, totpCounter(new Date()));

/** A fully-populated user row: any missing field here would silently fall back to a default. */
function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    email: "test@example.com",
    username: "test",
    name: "Test",
    password: bcrypt.hashSync("correctpass", 4),
    status: "ACTIVE",
    branchId: 1,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastFailedLoginAt: null,
    passwordChangedAt: new Date(),
    mustChangePassword: false,
    passwordHistory: [],
    twoFactorSecret: null,
    twoFactorEnabled: false,
    twoFactorRecovery: null,
    tokenVersion: 0,
    branch: { id: 1, name: "Main Branch", code: "MAIN" },
    userRoles: [{ role: { id: 1, seederKey: "ADMIN", name: "Admin" } }],
    ...overrides,
  };
}

function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    email: "admin@example.com",
    name: "Admin",
    branchId: 1,
    status: "ACTIVE",
    roles: [{ id: 1, seederKey: "ADMIN", name: "Administrator" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The policy reader caches for a few seconds; reset it so each test starts clean.
  invalidateSecurityPolicyCache();
  asMock("securitySetting", "findFirst").mockResolvedValue(null);
  asMock("systemMaintenance", "findFirst").mockResolvedValue({ maintenanceMode: false });
  asMock("rolePermission", "count").mockResolvedValue(1);
  asMock("loginAttempt", "create").mockResolvedValue({});
  asMock("userSession", "count").mockResolvedValue(0);
  asMock("userSession", "create").mockResolvedValue({});
  asMock("userSession", "updateMany").mockResolvedValue({ count: 1 });
  asMock("user", "update").mockResolvedValue({});
});

describe("auth.service — login", () => {
  it("returns the user, roles and a token on valid credentials", async () => {
    asMock("user", "findFirst").mockResolvedValue(makeUser());

    const result = await authService.login({ identifier: "test@example.com", password: "correctpass" });

    expect(result.accessToken).toBe("mock-jwt-token");
    expect(result.roles).toEqual(["ADMIN"]);
    expect(result.user.email).toBe("test@example.com");
    expect(result.mustChangePassword).toBe(false);
  });

  it("creates a server-side session whose expiry IS the session timeout", async () => {
    asMock("user", "findFirst").mockResolvedValue(makeUser());
    asMock("securitySetting", "findFirst").mockResolvedValue({ sessionTimeout: 15 });

    const before = Date.now();
    const result = await authService.login({ identifier: "test@example.com", password: "correctpass" });

    const created = asMock("userSession", "create").mock.calls[0][0].data;
    expect(created.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
    expect(created.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
    expect(created.tokenId).toEqual(expect.any(String));
    // The JWT jti must match the session row, otherwise revocation cannot work,
    // and the token lifetime must follow the configured timeout so the two
    // expire together.
    expect(signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ jti: created.tokenId }),
      15,
    );
    expect(result.sessionMaxAgeMs).toBeGreaterThan(14 * 60 * 1000);
  });

  it("resets the failed-attempt counter after a successful sign-in", async () => {
    asMock("user", "findFirst").mockResolvedValue(makeUser({ failedLoginAttempts: 2 }));

    await authService.login({ identifier: "test@example.com", password: "correctpass" });

    expect(asMock("user", "update").mock.calls[0][0].data).toMatchObject({
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  });

  it("rejects a wrong password with a generic message and counts the failure", async () => {
    asMock("user", "findFirst").mockResolvedValue(makeUser());

    await expect(
      authService.login({ identifier: "test@example.com", password: "wrong" }),
    ).rejects.toThrow("Invalid email/username or password");

    expect(asMock("user", "update").mock.calls[0][0].data).toMatchObject({ failedLoginAttempts: 1 });
    expect(asMock("userSession", "create")).not.toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ module: "AUTH", action: "LOGIN_FAILED", always: true }),
    );
  });

  it("gives the generic message for an unknown identifier and records the attempt without a user", async () => {
    asMock("user", "findFirst").mockResolvedValue(null);

    await expect(
      authService.login({ identifier: "ghost@example.com", password: "x" }),
    ).rejects.toThrow("Invalid email/username or password");

    expect(asMock("loginAttempt", "create").mock.calls[0][0].data).toMatchObject({
      userId: null,
      success: false,
      reason: "BAD_PASSWORD",
    });
    // The same message as a wrong password: no account enumeration.
    await expect(
      authService.login({ identifier: "ghost@example.com", password: "x" }),
    ).rejects.toThrow("Invalid email/username or password");
  });

  it("rejects a LOCKED / SUSPENDED account", async () => {
    asMock("user", "findFirst").mockResolvedValue(makeUser({ status: "SUSPENDED" }));

    await expect(
      authService.login({ identifier: "test@example.com", password: "correctpass" }),
    ).rejects.toThrow("Account is not active");
  });

  it("blocks sign-in while maintenance mode is active unless the role can manage it", async () => {
    asMock("user", "findFirst").mockResolvedValue(makeUser());
    asMock("systemMaintenance", "findFirst").mockResolvedValue({ maintenanceMode: true });
    asMock("rolePermission", "count").mockResolvedValue(0);

    await expect(
      authService.login({ identifier: "test@example.com", password: "correctpass" }),
    ).rejects.toThrow("maintenance mode");

    expect(asMock("userSession", "create")).not.toHaveBeenCalled();
    expect(asMock("loginAttempt", "create")).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reason: "MAINTENANCE_MODE" }) }),
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ module: "AUTH", action: "LOGIN_BLOCKED_MAINTENANCE", always: true }),
    );
  });

  it("lets a role with systemMaintenance:update sign in during maintenance mode", async () => {
    asMock("user", "findFirst").mockResolvedValue(makeUser());
    asMock("systemMaintenance", "findFirst").mockResolvedValue({ maintenanceMode: true });
    asMock("rolePermission", "count").mockResolvedValue(1);

    const result = await authService.login({ identifier: "test@example.com", password: "correctpass" });

    expect(result.accessToken).toBe("mock-jwt-token");
  });
});

describe("auth.service — brute-force lockout (maxLoginAttempts / lockoutDurationMinutes)", () => {
  const HASH = bcrypt.hashSync("correctpass", 4);

  it("locks the account on the configured Nth failure", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ maxLoginAttempts: 3 });
    asMock("user", "findFirst").mockResolvedValue(makeUser({ password: HASH, failedLoginAttempts: 2 }));

    await expect(
      authService.login({ identifier: "test@example.com", password: "wrong" }, { ip: "1.2.3.4" }),
    ).rejects.toThrow("Account locked after 3 failed attempts");

    const update = asMock("user", "update").mock.calls[0][0].data;
    expect(update.failedLoginAttempts).toBe(3);
    expect(update.lockedUntil).toBeInstanceOf(Date);
    expect(update.lockedUntil.getTime()).toBeGreaterThan(Date.now());
    expect(asMock("loginAttempt", "create").mock.calls[0][0].data.reason).toBe("BAD_PASSWORD");
  });

  it("tells the caller how many attempts remain below the limit", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ maxLoginAttempts: 3 });
    asMock("user", "findFirst").mockResolvedValue(makeUser({ failedLoginAttempts: 0 }));

    await expect(
      authService.login({ identifier: "test@example.com", password: "wrong" }),
    ).rejects.toThrow("2 attempts remaining");
  });

  it("refuses even the CORRECT password while the lock is active", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ maxLoginAttempts: 3 });
    asMock("user", "findFirst").mockResolvedValue(
      makeUser({
        password: HASH,
        failedLoginAttempts: 3,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      }),
    );

    await expect(
      authService.login({ identifier: "test@example.com", password: "correctpass" }),
    ).rejects.toThrow("temporarily locked after 3 failed attempts");
    expect(asMock("userSession", "create")).not.toHaveBeenCalled();
    expect(asMock("loginAttempt", "create").mock.calls[0][0].data.reason).toBe("LOCKED");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "LOGIN_BLOCKED_LOCKED", always: true }),
    );
  });

  it("clears the counter and allows sign-in once the lock window has passed", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ maxLoginAttempts: 3 });
    asMock("user", "findFirst").mockResolvedValue(
      makeUser({
        failedLoginAttempts: 3,
        lockedUntil: new Date(Date.now() - 60 * 1000),
      }),
    );

    const result = await authService.login({ identifier: "test@example.com", password: "correctpass" });

    expect(result.user.id).toBe(1);
    // The expired lock is cleared before any password check.
    expect(asMock("user", "update").mock.calls[0][0].data).toMatchObject({
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  });
});

describe("auth.service — IP restriction", () => {
  it("blocks a login from an address outside the allow-list and never looks up the user", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({
      ipRestrictionEnabled: true,
      allowedIpRanges: "10.0.0.0/8",
    });

    await expect(
      authService.login({ identifier: "test@example.com", password: "correctpass" }, { ip: "8.8.8.8" }),
    ).rejects.toThrow("not in the allow-list");

    expect(asMock("user", "findFirst")).not.toHaveBeenCalled();
    expect(asMock("loginAttempt", "create").mock.calls[0][0].data.reason).toBe("IP_BLOCKED");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "LOGIN_BLOCKED_IP", always: true }),
    );
  });

  it("fails closed when the allow-list is empty", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({
      ipRestrictionEnabled: true,
      allowedIpRanges: null,
    });

    await expect(
      authService.login({ identifier: "test@example.com", password: "correctpass" }, { ip: "10.0.0.5" }),
    ).rejects.toThrow("no allowed IP ranges");
  });

  it("allows an address inside a configured CIDR", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({
      ipRestrictionEnabled: true,
      allowedIpRanges: "10.0.0.0/8, 127.0.0.1",
    });
    asMock("user", "findFirst").mockResolvedValue(makeUser());

    const result = await authService.login(
      { identifier: "test@example.com", password: "correctpass" },
      { ip: "10.1.2.3" },
    );
    expect(result.user.id).toBe(1);
  });
});

describe("auth.service — device restriction (maxConcurrentSessions)", () => {
  it("blocks a login once the active session count reaches the limit", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({
      deviceRestrictionEnabled: true,
      maxConcurrentSessions: 2,
    });
    asMock("user", "findFirst").mockResolvedValue(makeUser());
    asMock("userSession", "count").mockResolvedValue(2);

    await expect(
      authService.login({ identifier: "test@example.com", password: "correctpass" }),
    ).rejects.toThrow("Device limit reached (2 active sessions)");

    expect(asMock("userSession", "create")).not.toHaveBeenCalled();
    expect(asMock("loginAttempt", "create").mock.calls[0][0].data.reason).toBe("DEVICE_BLOCKED");
  });

  it("ignores the device limit while the toggle is off", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({
      deviceRestrictionEnabled: false,
      maxConcurrentSessions: 1,
    });
    asMock("user", "findFirst").mockResolvedValue(makeUser());
    asMock("userSession", "count").mockResolvedValue(9);

    await expect(
      authService.login({ identifier: "test@example.com", password: "correctpass" }),
    ).resolves.toBeTruthy();
  });

  it("only counts sessions that are neither revoked nor expired", async () => {
    asMock("user", "findFirst").mockResolvedValue(makeUser());
    await authService.login({ identifier: "test@example.com", password: "correctpass" });

    const where = asMock("userSession", "count").mock.calls[0][0].where;
    expect(where).toMatchObject({ revokedAt: null });
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });
});

describe("auth.service — two-factor authentication", () => {
  it("requires a code once 2FA is globally on and the user is enrolled", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ twoFactorEnabled: true });
    asMock("user", "findFirst").mockResolvedValue(
      makeUser({ twoFactorEnabled: true, twoFactorSecret: TOTP_SECRET }),
    );

    await expect(
      authService.login({ identifier: "test@example.com", password: "correctpass" }),
    ).rejects.toThrow("valid two-factor code or recovery code is required");
    expect(asMock("userSession", "create")).not.toHaveBeenCalled();
    expect(asMock("loginAttempt", "create").mock.calls[0][0].data.reason).toBe("TWO_FACTOR_FAILED");
  });

  it("accepts a valid TOTP code", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ twoFactorEnabled: true });
    asMock("user", "findFirst").mockResolvedValue(
      makeUser({ twoFactorEnabled: true, twoFactorSecret: TOTP_SECRET }),
    );

    const result = await authService.login({
      identifier: "test@example.com",
      password: "correctpass",
      twoFactorCode: currentTotp(),
    });
    expect(result.accessToken).toBe("mock-jwt-token");
  });

  it("rejects a wrong TOTP code", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ twoFactorEnabled: true });
    asMock("user", "findFirst").mockResolvedValue(
      makeUser({ twoFactorEnabled: true, twoFactorSecret: TOTP_SECRET }),
    );

    await expect(
      authService.login({
        identifier: "test@example.com",
        password: "correctpass",
        twoFactorCode: "000000",
      }),
    ).rejects.toThrow("valid two-factor code or recovery code is required");
  });

  it("accepts a recovery code and burns it", async () => {
    const recoveryHash = bcrypt.hashSync("A7K2-9M4Q", 4);
    asMock("securitySetting", "findFirst").mockResolvedValue({ twoFactorEnabled: true });
    asMock("user", "findFirst").mockResolvedValue(
      makeUser({
        twoFactorEnabled: true,
        twoFactorSecret: TOTP_SECRET,
        twoFactorRecovery: [recoveryHash, "other-hash"],
      }),
    );

    const result = await authService.login({
      identifier: "test@example.com",
      password: "correctpass",
      recoveryCode: "a7k2-9m4q",
    });

    expect(result.accessToken).toBe("mock-jwt-token");
    const consumed = asMock("user", "update").mock.calls.find(
      (c: unknown[]) => (c[0] as { data: Record<string, unknown> }).data.twoFactorRecovery !== undefined,
    );
    expect(consumed?.[0].data.twoFactorRecovery).toEqual(["other-hash"]);
  });

  it("does not challenge a user who has not enrolled, even when 2FA is globally on", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ twoFactorEnabled: true });
    asMock("user", "findFirst").mockResolvedValue(makeUser({ twoFactorEnabled: false }));

    await expect(
      authService.login({ identifier: "test@example.com", password: "correctpass" }),
    ).resolves.toBeTruthy();
  });

  it("does not challenge an enrolled user while 2FA is globally off", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ twoFactorEnabled: false });
    asMock("user", "findFirst").mockResolvedValue(
      makeUser({ twoFactorEnabled: true, twoFactorSecret: TOTP_SECRET }),
    );

    await expect(
      authService.login({ identifier: "test@example.com", password: "correctpass" }),
    ).resolves.toBeTruthy();
  });
});

describe("auth.service — password expiry", () => {
  it("flags the session as must-change when the password has aged out", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ passwordExpiryDays: 90 });
    asMock("user", "findFirst").mockResolvedValue(
      makeUser({ passwordChangedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) }),
    );

    const result = await authService.login({ identifier: "test@example.com", password: "correctpass" });

    expect(result.mustChangePassword).toBe(true);
    expect(asMock("user", "update")).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ mustChangePassword: true }) }),
    );
  });

  it("does not flag a fresh password", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ passwordExpiryDays: 90 });
    asMock("user", "findFirst").mockResolvedValue(makeUser());

    const result = await authService.login({ identifier: "test@example.com", password: "correctpass" });
    expect(result.mustChangePassword).toBe(false);
  });

  it("treats a NULL passwordChangedAt as expired", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ passwordExpiryDays: 90 });
    asMock("user", "findFirst").mockResolvedValue(makeUser({ passwordChangedAt: null }));

    const result = await authService.login({ identifier: "test@example.com", password: "correctpass" });
    expect(result.mustChangePassword).toBe(true);
  });

  it("never expires when the setting is 0", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({ passwordExpiryDays: 0 });
    asMock("user", "findFirst").mockResolvedValue(makeUser({ passwordChangedAt: null }));

    const result = await authService.login({ identifier: "test@example.com", password: "correctpass" });
    expect(result.mustChangePassword).toBe(false);
  });
});

describe("auth.service — assertSessionActive (session timeout / revocation)", () => {
  const session = {
    id: 5,
    userId: 1,
    tokenId: "jti-1",
    expiresAt: new Date(Date.now() + 60 * 1000),
    revokedAt: null,
    lastSeenAt: new Date(),
  };

  it("accepts a live session", async () => {
    asMock("userSession", "findUnique").mockResolvedValue(session);
    asMock("user", "findUnique").mockResolvedValue({ tokenVersion: 0 });

    await expect(
      authService.assertSessionActive({ userId: 1, tokenId: "jti-1", tokenVersion: 0 }),
    ).resolves.toBeUndefined();
  });

  it("rejects an unknown token id", async () => {
    asMock("userSession", "findUnique").mockResolvedValue(null);

    await expect(
      authService.assertSessionActive({ userId: 1, tokenId: "nope", tokenVersion: 0 }),
    ).rejects.toThrow("Session is no longer valid");
  });

  it("rejects a session belonging to another user", async () => {
    asMock("userSession", "findUnique").mockResolvedValue({ ...session, userId: 99 });

    await expect(
      authService.assertSessionActive({ userId: 1, tokenId: "jti-1", tokenVersion: 0 }),
    ).rejects.toThrow("Session is no longer valid");
  });

  it("rejects a revoked session (logout)", async () => {
    asMock("userSession", "findUnique").mockResolvedValue({ ...session, revokedAt: new Date() });

    await expect(
      authService.assertSessionActive({ userId: 1, tokenId: "jti-1", tokenVersion: 0 }),
    ).rejects.toThrow("Session has been signed out");
  });

  it("rejects an expired session (the session timeout setting)", async () => {
    asMock("userSession", "findUnique").mockResolvedValue({
      ...session,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      authService.assertSessionActive({ userId: 1, tokenId: "jti-1", tokenVersion: 0 }),
    ).rejects.toThrow("Session expired, please sign in again");
  });

  it("rejects a token whose version was bumped (revoke-all)", async () => {
    asMock("userSession", "findUnique").mockResolvedValue(session);
    asMock("user", "findUnique").mockResolvedValue({ tokenVersion: 3 });

    await expect(
      authService.assertSessionActive({ userId: 1, tokenId: "jti-1", tokenVersion: 0 }),
    ).rejects.toThrow("Session is no longer valid");
  });
});

describe("auth.service — revokeSessions", () => {
  it("revokes every active session for the user when no id is given", async () => {
    asMock("userSession", "updateMany").mockResolvedValue({ count: 3 });

    const count = await authService.revokeSessions(7, { reason: "revoke-all" });

    expect(count).toBe(3);
    expect(asMock("userSession", "updateMany").mock.calls[0][0].where).toEqual({
      userId: 7,
      revokedAt: null,
    });
    expect(asMock("userSession", "updateMany").mock.calls[0][0].data.revokedReason).toBe("revoke-all");
  });

  it("revokes a single session by id", async () => {
    asMock("userSession", "updateMany").mockResolvedValue({ count: 1 });

    await authService.revokeSessions(7, { sessionId: 42 });

    expect(asMock("userSession", "updateMany").mock.calls[0][0].where).toEqual({
      userId: 7,
      revokedAt: null,
      id: 42,
    });
  });
});

describe("auth.service — getCurrentUser", () => {
  it("returns the user if ACTIVE", async () => {
    asMock("user", "findUnique").mockResolvedValue(
      makeUser({ mustChangePassword: true, twoFactorEnabled: true }),
    );

    const result = await authService.getCurrentUser(1);
    expect(result.user.id).toBe(1);
    expect(result.user.mustChangePassword).toBe(true);
    expect(result.user.twoFactorEnabled).toBe(true);
    expect(result.roles).toEqual(["ADMIN"]);
  });

  it("throws for a non-ACTIVE user", async () => {
    asMock("user", "findUnique").mockResolvedValue(makeUser({ status: "LOCKED" }));

    await expect(authService.getCurrentUser(1)).rejects.toThrow("Account is not active");
  });

  it("throws when the user has been deleted", async () => {
    asMock("user", "findUnique").mockResolvedValue(null);

    await expect(authService.getCurrentUser(1)).rejects.toThrow("User no longer exists");
  });
});

describe("auth.service — changePassword", () => {
  const userRow = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    password: bcrypt.hashSync("correctpass", 4),
    status: "ACTIVE",
    branchId: 1,
    passwordHistory: [],
    ...overrides,
  });

  it("succeeds, updates the lifecycle fields and revokes other sessions", async () => {
    asMock("user", "findUnique")
      .mockResolvedValueOnce(userRow())
      .mockResolvedValueOnce({ passwordHistory: [] });
    asMock("user", "update").mockResolvedValue({});
    asMock("userSession", "updateMany").mockResolvedValue({ count: 2 });

    await authService.changePassword(makeAuthUser(), {
      currentPassword: "correctpass",
      newPassword: "N3wsecurepass!",
    });

    const stored = asMock("user", "update").mock.calls[0][0].data;
    expect(stored.passwordChangedAt).toBeInstanceOf(Date);
    expect(stored.mustChangePassword).toBe(false);
    // historyCount defaults to 0, so nothing new is retained by default.
    expect(stored.passwordHistory).toEqual([]);
    expect(asMock("userSession", "updateMany")).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1, revokedAt: null },
        data: expect.objectContaining({ revokedReason: "password-changed" }),
      }),
    );
  });

  it("throws when the current password is wrong and audits the failure", async () => {
    asMock("user", "findUnique").mockResolvedValue(userRow());

    await expect(
      authService.changePassword(makeAuthUser(), {
        currentPassword: "wrongpass",
        newPassword: "N3wsecurepass!",
      }),
    ).rejects.toThrow("Current password is incorrect");

    expect(asMock("user", "update")).not.toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PASSWORD_CHANGE_FAILED", always: true }),
    );
  });

  it("rejects reusing the current password", async () => {
    asMock("user", "findUnique").mockResolvedValue(userRow());

    await expect(
      authService.changePassword(makeAuthUser(), {
        currentPassword: "correctpass",
        newPassword: "correctpass",
      }),
    ).rejects.toThrow("New password must be different");
  });

  it("enforces passwordMinLength from the live setting", async () => {
    asMock("user", "findUnique").mockResolvedValue(userRow());
    asMock("securitySetting", "findFirst").mockResolvedValue({ passwordMinLength: 12 });

    await expect(
      authService.changePassword(makeAuthUser(), {
        currentPassword: "correctpass",
        newPassword: "Sh0rtpass!",
      }),
    ).rejects.toThrow("Password must be at least 12 characters");
  });

  it("enforces the character-class rules", async () => {
    asMock("user", "findUnique").mockResolvedValue(userRow());
    asMock("securitySetting", "findFirst").mockResolvedValue({
      passwordMinLength: 8,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumber: true,
      passwordRequireSymbol: true,
    });

    await expect(
      authService.changePassword(makeAuthUser(), {
        currentPassword: "correctpass",
        newPassword: "lowercase1",
      }),
    ).rejects.toThrow("Password must contain at least one uppercase letter");
  });

  it("rejects a password already in the history window", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({
      passwordHistoryCount: 2,
      passwordMinLength: 8,
      passwordRequireLowercase: true,
      passwordRequireNumber: true,
    });
    asMock("user", "findUnique").mockResolvedValue(
      userRow({ passwordHistory: [bcrypt.hashSync("0ldsecret1", 4)] }),
    );

    await expect(
      authService.changePassword(makeAuthUser(), {
        currentPassword: "correctpass",
        newPassword: "0ldsecret1",
      }),
    ).rejects.toThrow("cannot reuse any of your last 2 passwords");
  });

  it("keeps the history bounded to passwordHistoryCount", async () => {
    asMock("securitySetting", "findFirst").mockResolvedValue({
      passwordHistoryCount: 2,
      passwordMinLength: 8,
      passwordRequireLowercase: true,
      passwordRequireNumber: true,
    });
    asMock("user", "findUnique")
      .mockResolvedValueOnce(userRow({ passwordHistory: ["old-1", "old-2", "old-3"] }))
      .mockResolvedValueOnce({ passwordHistory: ["old-1", "old-2", "old-3"], password: "old-1" });
    asMock("user", "update").mockResolvedValue({});

    await authService.changePassword(makeAuthUser(), {
      currentPassword: "correctpass",
      newPassword: "Fr3shsecret1",
    });

    const stored = asMock("user", "update").mock.calls[0][0].data;
    expect(stored.passwordHistory).toHaveLength(2);
    // Newest superseded hash first, then the next one back.
    expect(stored.passwordHistory).toEqual(["old-1", "old-2"]);
  });

  it("blocks the previous password even when passwordHistoryCount is 1", async () => {
    // The window must hold superseded hashes only. Storing the current hash as
    // well would consume the single slot and make historyCount=1 a no-op.
    const currentHash = bcrypt.hashSync("correctpass", 4);
    asMock("securitySetting", "findFirst").mockResolvedValue({
      passwordHistoryCount: 1,
      passwordMinLength: 8,
      passwordRequireLowercase: true,
      passwordRequireNumber: true,
    });
    asMock("user", "findUnique")
      .mockResolvedValueOnce(userRow({ password: currentHash, passwordHistory: [] }))
      .mockResolvedValueOnce({ passwordHistory: [], password: currentHash });
    asMock("user", "update").mockResolvedValue({});

    await authService.changePassword(makeAuthUser(), {
      currentPassword: "correctpass",
      newPassword: "Fr3shsecret1",
    });

    const stored = asMock("user", "update").mock.calls[0][0].data;
    expect(stored.passwordHistory).toEqual([currentHash]);
    expect(stored.passwordHistory).not.toContain(stored.password);
    await expect(
      assertPasswordNotReused("correctpass", stored.passwordHistory, { passwordHistoryCount: 1 }),
    ).rejects.toThrow("cannot reuse any of your last 1 password");
  });

  it("records the superseded password so the reuse window is not empty", async () => {
    // Regression: only the new hash was stored, so the reuse window held nothing
    // but the current password and passwordHistoryCount had no real effect.
    const currentHash = bcrypt.hashSync("correctpass", 4);
    asMock("securitySetting", "findFirst").mockResolvedValue({
      passwordHistoryCount: 3,
      passwordMinLength: 8,
      passwordRequireLowercase: true,
      passwordRequireNumber: true,
    });
    asMock("user", "findUnique")
      .mockResolvedValueOnce(userRow({ password: currentHash, passwordHistory: [] }))
      .mockResolvedValueOnce({ passwordHistory: [], password: currentHash });
    asMock("user", "update").mockResolvedValue({});

    await authService.changePassword(makeAuthUser(), {
      currentPassword: "correctpass",
      newPassword: "Fr3shsecret1",
    });

    const stored = asMock("user", "update").mock.calls[0][0].data;
    expect(stored.passwordHistory).toContain(currentHash);
    // ...and the superseded password is now inside the window, so reusing it fails.
    await expect(
      assertPasswordNotReused("correctpass", stored.passwordHistory, { passwordHistoryCount: 3 }),
    ).rejects.toThrow("cannot reuse any of your last 3 passwords");
  });

  it("does not retain history when passwordHistoryCount is 0", async () => {
    const currentHash = bcrypt.hashSync("correctpass", 4);
    asMock("securitySetting", "findFirst").mockResolvedValue({ passwordHistoryCount: 0 });
    asMock("user", "findUnique")
      .mockResolvedValueOnce(userRow({ password: currentHash, passwordHistory: [currentHash] }))
      .mockResolvedValueOnce({ passwordHistory: [currentHash], password: currentHash });
    asMock("user", "update").mockResolvedValue({});

    await authService.changePassword(makeAuthUser(), {
      currentPassword: "correctpass",
      newPassword: "Fr3shsecret1",
    });

    const stored = asMock("user", "update").mock.calls[0][0].data;
    expect(stored.passwordHistory).toEqual([]);
  });

  it("stores history as a JSON array, not a JSON-encoded string", async () => {
    // Regression: passwordHistory is a Prisma Json column. Assigning
    // JSON.stringify([...]) stores a JSON *string*, which reads back as a string
    // and made the reuse check silently inert for that account.
    asMock("securitySetting", "findFirst").mockResolvedValue({ passwordHistoryCount: 2 });
    asMock("user", "findUnique")
      .mockResolvedValueOnce(userRow())
      .mockResolvedValueOnce({ passwordHistory: [], password: "old-hash" });
    asMock("user", "update").mockResolvedValue({});

    await authService.changePassword(makeAuthUser(), {
      currentPassword: "correctpass",
      newPassword: "Fr3shsecret1",
    });

    const stored = asMock("user", "update").mock.calls[0][0].data;
    expect(Array.isArray(stored.passwordHistory)).toBe(true);
    expect(typeof stored.passwordHistory).toBe("object");
  });

  it("still blocks reuse when history was stored as a JSON-encoded string", async () => {
    const oldHash = bcrypt.hashSync("0ldsecret1", 4);
    await expect(
      assertPasswordNotReused("0ldsecret1", JSON.stringify([oldHash]), { passwordHistoryCount: 3 }),
    ).rejects.toThrow("cannot reuse any of your last 3 passwords");
  });

  it("ignores malformed history instead of throwing", async () => {
    await expect(
      assertPasswordNotReused("whatever1", "{not json", { passwordHistoryCount: 3 }),
    ).resolves.toBeUndefined();
  });
});

describe("auth.service — adminResetPassword / unlockUser", () => {
  it("forces a change and revokes sessions after an admin reset", async () => {
    asMock("user", "findUnique")
      .mockResolvedValueOnce({ id: 5, branchId: 1, passwordHistory: [], password: "old" })
      .mockResolvedValueOnce({ passwordHistory: [] });
    asMock("user", "update").mockResolvedValue({});

    await authService.adminResetPassword(makeAuthUser(), 5, { newPassword: "Res3tsecret1" });

    const stored = asMock("user", "update").mock.calls[0][0].data;
    expect(stored.mustChangePassword).toBe(true);
    expect(asMock("userSession", "updateMany")).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 5, revokedAt: null } }),
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ module: "SECURITY", action: "PASSWORD_RESET_BY_ADMIN" }),
    );
  });

  it("enforces the policy on an admin reset too", async () => {
    asMock("user", "findUnique").mockResolvedValue({
      id: 5,
      branchId: 1,
      passwordHistory: [],
      password: "old",
    });
    asMock("securitySetting", "findFirst").mockResolvedValue({ passwordRequireSymbol: true });

    await expect(
      authService.adminResetPassword(makeAuthUser(), 5, { newPassword: "weakpass1" }),
    ).rejects.toThrow("special character");
  });

  it("clears the lockout without touching an ACTIVE account's status", async () => {
    // An unlock is a lockout operation. Overwriting status would silently
    // reactivate accounts an administrator had deliberately suspended.
    asMock("user", "findUnique").mockResolvedValue({ id: 5, status: "ACTIVE" });
    asMock("user", "update").mockResolvedValue({ id: 5 });

    await authService.unlockUser(makeAuthUser(), 5);

    expect(asMock("user", "update")).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { failedLoginAttempts: 0, lockedUntil: null },
      select: { id: true },
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ACCOUNT_UNLOCKED", always: true }),
    );
  });

  it("reactivates an account whose status is LOCKED", async () => {
    asMock("user", "findUnique").mockResolvedValue({ id: 5, status: "LOCKED" });
    asMock("user", "update").mockResolvedValue({ id: 5 });

    await authService.unlockUser(makeAuthUser(), 5);

    expect(asMock("user", "update")).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE" }) }),
    );
  });

  it("refuses to unlock a suspended or inactive account", async () => {
    for (const status of ["SUSPENDED", "INACTIVE"] as const) {
      asMock("user", "findUnique").mockResolvedValue({ id: 5, status });

      await expect(authService.unlockUser(makeAuthUser(), 5)).rejects.toThrow(
        `Cannot unlock: this account is ${status.toLowerCase()}`,
      );
      expect(asMock("user", "update")).not.toHaveBeenCalled();
    }
  });

  it("reports a missing target instead of failing with a Prisma error", async () => {
    asMock("user", "findUnique").mockResolvedValue(null);

    await expect(authService.unlockUser(makeAuthUser(), 999)).rejects.toThrow("User not found");
    expect(asMock("user", "update")).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// User Service — Branch Isolation
// ----------------------------------------------------------------
import * as userService from "../modules/users/user.service";

describe("user.service — branch isolation", () => {
  it("ADMIN can list only own branch users", async () => {
    const actor = makeAuthUser();
    asMock("user", "count").mockResolvedValue(1);
    asMock("user", "findMany").mockResolvedValue([]);

    await userService.listUsers(actor, {});
    expect(asMock("user", "count").mock.calls[0][0].where).toMatchObject({ branchId: 1 });
  });

  it("SUPER_ADMIN can list across branches", async () => {
    const actor = makeAuthUser({ roles: [{ id: 1, seederKey: "SUPER_ADMIN", name: "Super Admin" }] });
    asMock("user", "count").mockResolvedValue(0);
    asMock("user", "findMany").mockResolvedValue([]);

    await userService.listUsers(actor, {});
    const where = asMock("user", "count").mock.calls[0][0].where;
    expect(where.branchId).toBeUndefined();
  });

  it("ADMIN cannot create a user in another branch", async () => {
    const actor = makeAuthUser({ branchId: 1 });
    asMock("branch", "findUnique").mockResolvedValue(null);
    asMock("role", "findMany").mockResolvedValue([]);
    asMock("user", "findFirst").mockResolvedValue(null);

    await expect(
      userService.createUser(actor, {
        name: "Test",
        email: "test@test.com",
        username: "test",
        password: "testpass123",
        branchId: 99,
        roleIds: [1],
      }),
    ).rejects.toThrow("You do not have permission");
  });

  it("enforces the live password policy when creating a user", async () => {
    const actor = makeAuthUser({ roles: [{ id: 2, seederKey: "SUPER_ADMIN", name: "Super Admin" }] });
    asMock("branch", "findUnique").mockResolvedValue({ id: 1, name: "Main", code: "M" });
    asMock("role", "findMany").mockResolvedValue([{ id: 1 }]);
    asMock("user", "findFirst").mockResolvedValue(null);
    asMock("securitySetting", "findFirst").mockResolvedValue({ passwordMinLength: 12 });

    await expect(
      userService.createUser(actor, {
        name: "Test",
        email: "test@test.com",
        username: "testuser",
        password: "short123",
        branchId: 1,
        roleIds: [1],
      }),
    ).rejects.toThrow("Password must be at least 12 characters");
  });

  it("enforces the character-class rules when creating a user", async () => {
    const actor = makeAuthUser({ roles: [{ id: 2, seederKey: "SUPER_ADMIN", name: "Super Admin" }] });
    asMock("branch", "findUnique").mockResolvedValue({ id: 1, name: "Main", code: "M" });
    asMock("role", "findMany").mockResolvedValue([{ id: 1 }]);
    asMock("user", "findFirst").mockResolvedValue(null);
    asMock("securitySetting", "findFirst").mockResolvedValue({
      passwordMinLength: 8,
      passwordRequireLowercase: true,
      passwordRequireNumber: true,
      passwordRequireSymbol: true,
    });

    await expect(
      userService.createUser(actor, {
        name: "Test",
        email: "test@test.com",
        username: "testuser",
        password: "weakpass1",
        branchId: 1,
        roleIds: [1],
      }),
    ).rejects.toThrow("Password must contain at least one special character");
  });

  it("stamps passwordChangedAt and seeds history on creation", async () => {
    const actor = makeAuthUser({ roles: [{ id: 2, seederKey: "SUPER_ADMIN", name: "Super Admin" }] });
    asMock("branch", "findUnique").mockResolvedValue({ id: 1, name: "Main", code: "M" });
    asMock("role", "findMany").mockResolvedValue([{ id: 1 }]);
    asMock("user", "findFirst").mockResolvedValue(null);
    asMock("user", "create").mockResolvedValue({ id: 77 });
    asMock("userRole", "createMany").mockResolvedValue({ count: 1 });

    await userService.createUser(actor, {
      name: "Test",
      email: "test@test.com",
      username: "testuser",
      password: "Str0ngpass!",
      branchId: 1,
      roleIds: [1],
    });

    const data = asMock("user", "create").mock.calls[0][0].data;
    expect(data.passwordChangedAt).toBeInstanceOf(Date);
    expect(data.passwordHistory).toEqual([data.password]);
  });
});