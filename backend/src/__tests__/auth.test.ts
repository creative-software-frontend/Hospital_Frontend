import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

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
    branch: {
      findUnique: vi.fn(),
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
    $transaction: vi.fn(async (fns: unknown[]) => {
      const results = [];
      for (const fn of fns) {
        if (typeof fn === "function") results.push(await fn());
      }
      return results;
    }),
  },
}));

vi.mock("../utils/token", () => ({
  signAccessToken: vi.fn(() => "mock-jwt-token"),
}));

vi.mock("../utils/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
}));

const mockPrisma = vi.mocked(await import("../lib/prisma")).prisma;

// ----------------------------------------------------------------
// Auth Service
// ----------------------------------------------------------------
import * as authService from "../modules/auth/auth.service";

describe("auth.service", () => {
  const HASH = bcrypt.hashSync("correctpass", 4);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("returns user + token on valid credentials", async () => {
      (mockPrisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1,
        email: "test@example.com",
        username: "test",
        name: "Test",
        password: HASH,
        status: "ACTIVE",
        branchId: 1,
        userRoles: [{ role: { id: 1, seederKey: "ADMIN", name: "Admin" } }],
      });
      (mockPrisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await authService.login({ identifier: "test@example.com", password: "correctpass" });
      expect(result.accessToken).toBe("mock-jwt-token");
      expect(result.roles).toEqual(["ADMIN"]);
      expect(result.user.email).toBe("test@example.com");
    });

    it("throws AuthenticationError on wrong password (generic message)", async () => {
      (mockPrisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1,
        email: "test@example.com",
        username: "test",
        name: "Test",
        password: HASH,
        status: "ACTIVE",
        branchId: 1,
        userRoles: [{ role: { id: 1, seederKey: "ADMIN", name: "Admin" } }],
      });

      await expect(authService.login({ identifier: "test@example.com", password: "wrong" })).rejects.toThrow(
        "Invalid email/username or password",
      );
    });

    it("throws AuthenticationError when user not found (same generic message)", async () => {
      (mockPrisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await expect(authService.login({ identifier: "unknown@example.com", password: "x" })).rejects.toThrow(
        "Invalid email/username or password",
      );
    });

    it("throws AuthenticationError for non-ACTIVE user", async () => {
      (mockPrisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 2,
        email: "banned@example.com",
        username: "banned",
        name: "Banned",
        password: HASH,
        status: "SUSPENDED",
        branchId: 1,
        userRoles: [{ role: { id: 1, seederKey: "ADMIN", name: "Admin" } }],
      });

      await expect(authService.login({ identifier: "banned@example.com", password: "correctpass" })).rejects.toThrow(
        "Account is not active",
      );
    });
  });

  describe("getCurrentUser", () => {
    it("returns user if ACTIVE", async () => {
      (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1,
        email: "test@example.com",
        username: "test",
        name: "Test",
        status: "ACTIVE",
        branchId: 1,
        userRoles: [{ role: { id: 1, seederKey: "ADMIN", name: "Admin" } }],
      });

      const result = await authService.getCurrentUser(1);
      expect(result.user.id).toBe(1);
      expect(result.roles).toEqual(["ADMIN"]);
    });

    it("throws for non-ACTIVE user", async () => {
      (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1,
        email: "test@example.com",
        username: "test",
        name: "Test",
        status: "LOCKED",
        branchId: 1,
        userRoles: [],
      });

      await expect(authService.getCurrentUser(1)).rejects.toThrow("Account is not active");
    });
  });

  describe("changePassword", () => {
    it("succeeds when current password matches and new is different", async () => {
      (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1,
        password: HASH,
        status: "ACTIVE",
        branchId: 1,
      });
      (mockPrisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await expect(
        authService.changePassword(
          { id: 1, email: "t@t.com", name: "T", branchId: 1, status: "ACTIVE", roles: [{ id: 1, seederKey: "ADMIN", name: "Admin" }] },
          { currentPassword: "correctpass", newPassword: "newsecurepass123" },
        ),
      ).resolves.toBeUndefined();
    });

    it("throws when current password is wrong", async () => {
      (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1,
        password: HASH,
        status: "ACTIVE",
        branchId: 1,
      });

      await expect(
        authService.changePassword(
          { id: 1, email: "t@t.com", name: "T", branchId: 1, status: "ACTIVE", roles: [{ id: 1, seederKey: "ADMIN", name: "Admin" }] },
          { currentPassword: "wrongpass", newPassword: "newsecurepass123" },
        ),
      ).rejects.toThrow("Current password is incorrect");
    });

    it("rejects reuse of the same password", async () => {
      (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1,
        password: HASH,
        status: "ACTIVE",
        branchId: 1,
      });

      await expect(
        authService.changePassword(
          { id: 1, email: "t@t.com", name: "T", branchId: 1, status: "ACTIVE", roles: [{ id: 1, seederKey: "ADMIN", name: "Admin" }] },
          { currentPassword: "correctpass", newPassword: "correctpass" },
        ),
      ).rejects.toThrow("New password must be different");
    });
  });
});

// ----------------------------------------------------------------
// User Service — Branch Isolation
// ----------------------------------------------------------------
import * as userService from "../modules/users/user.service";
import type { AuthUser } from "../types/auth";

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

describe("user.service — branch isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ADMIN can list only own branch users", async () => {
    const actor = makeAuthUser();
    (mockPrisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await userService.listUsers(actor, {});
    expect(mockPrisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: 1 }) }),
    );
  });

  it("SUPER_ADMIN can list across branches", async () => {
    const actor = makeAuthUser({ roles: [{ id: 1, seederKey: "SUPER_ADMIN", name: "Super Admin" }] });
    (mockPrisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (mockPrisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await userService.listUsers(actor, {});
    // No branchId filter when no query.branchId
    expect(mockPrisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ branchId: expect.anything() }) }),
    );
  });

  it("ADMIN cannot create user in another branch", async () => {
    const actor = makeAuthUser({ branchId: 1 });
    (mockPrisma.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.role.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockPrisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

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
});
