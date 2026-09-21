import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const rolePermission = {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
  };
  const prisma = {
    role: { findMany: vi.fn(), findUnique: vi.fn() },
    permission: { findMany: vi.fn() },
    rolePermission,
    userRole: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        return arg({ rolePermission });
      }
      const results = [];
      for (const fn of arg as unknown[]) {
        if (typeof fn === "function") results.push(await fn());
      }
      return results;
    }),
  };
  return { prisma };
});

vi.mock("../utils/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
}));

const mockPrisma = vi.mocked(await import("../lib/prisma")).prisma;

import * as roleService from "../modules/roles/role.service";
import type { AuthUser } from "../types/auth";

function makeActor(role: "SUPER_ADMIN" | "ADMIN"): AuthUser {
  const isSuper = role === "SUPER_ADMIN";
  return {
    id: isSuper ? 9 : 2,
    email: isSuper ? "super@hospital.com" : "admin@hospital.com",
    name: isSuper ? "Super" : "Admin",
    branchId: 1,
    status: "ACTIVE",
    roles: [{ id: isSuper ? 1 : 2, seederKey: role, name: role }],
  };
}

describe("role.service — updateRolePermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses non-SUPER_ADMIN users", async () => {
    await expect(
      roleService.updateRolePermissions(makeActor("ADMIN"), 2, { permissionIds: [1] }),
    ).rejects.toThrow("SUPER_ADMIN role required");
  });

  it("replaces the permission set and audits the change", async () => {
    const actor = makeActor("SUPER_ADMIN");
    (mockPrisma.role.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2,
      name: "ADMIN",
      seederKey: "ADMIN",
      rolePermissions: [
        { permissionId: 1 },
        { permissionId: 3 },
      ],
    });
    (mockPrisma.permission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 4 },
      { id: 5 },
    ]);
    (mockPrisma.rolePermission.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
    (mockPrisma.rolePermission.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 4 });
    (mockPrisma.role.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await roleService.updateRolePermissions(actor, 2, { permissionIds: [1, 2, 4, 5] });

    expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 2 } });
    expect(mockPrisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: 2, permissionId: 1 },
        { roleId: 2, permissionId: 2 },
        { roleId: 2, permissionId: 4 },
        { roleId: 2, permissionId: 5 },
      ],
    });
  });

  it("rejects when a permission id does not exist", async () => {
    const actor = makeActor("SUPER_ADMIN");
    (mockPrisma.role.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2,
      name: "ADMIN",
      seederKey: "ADMIN",
      rolePermissions: [],
    });
    (mockPrisma.permission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1 },
    ]);

    await expect(
      roleService.updateRolePermissions(actor, 2, { permissionIds: [1, 999] }),
    ).rejects.toThrow("One or more permissions do not exist");
  });
});