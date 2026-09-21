import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const prisma = {
    branch: { count: vi.fn(), findMany: vi.fn() },
    user: { count: vi.fn(), groupBy: vi.fn() },
    patient: { count: vi.fn(), groupBy: vi.fn() },
    doctor: { count: vi.fn() },
    department: { count: vi.fn() },
    service: { count: vi.fn() },
    role: { count: vi.fn() },
    auditLog: { count: vi.fn(), findMany: vi.fn() },
  };
  return { prisma };
});

const mockPrisma = vi.mocked(await import("../lib/prisma")).prisma;

import * as superAdminService from "../modules/superadmin/superadmin.service";
import type { AuthUser } from "../types/auth";

function makeActor(role: "SUPER_ADMIN" | "ADMIN"): AuthUser {
  const isSuper = role === "SUPER_ADMIN";
  return {
    id: isSuper ? 9 : 2,
    email: isSuper ? "super@hospital.com" : "admin@hospital.com",
    name: isSuper ? "Super" : "Admin",
    branchId: isSuper ? 1 : 2,
    status: "ACTIVE",
    roles: [{ id: isSuper ? 1 : 2, seederKey: role, name: role }],
  };
}

describe("superAdmin.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses non-SUPER_ADMIN users", async () => {
    await expect(superAdminService.getDashboardStats(makeActor("ADMIN"))).rejects.toThrow(
      "SUPER_ADMIN role required",
    );
  });

  it("returns real counts for SUPER_ADMIN", async () => {
    const actor = makeActor("SUPER_ADMIN");
    (mockPrisma.branch.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    (mockPrisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(12);
    (mockPrisma.patient.count as ReturnType<typeof vi.fn>).mockResolvedValue(37);
    (mockPrisma.doctor.count as ReturnType<typeof vi.fn>).mockResolvedValue(6);
    (mockPrisma.department.count as ReturnType<typeof vi.fn>).mockResolvedValue(9);
    (mockPrisma.service.count as ReturnType<typeof vi.fn>).mockResolvedValue(14);
    (mockPrisma.role.count as ReturnType<typeof vi.fn>).mockResolvedValue(9);
    (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(500);
    (mockPrisma.branch.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, name: "Main Branch", code: "M", status: "active" },
      { id: 2, name: "Downtown", code: "D", status: "active" },
    ]);
    (mockPrisma.user.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { status: "ACTIVE", _count: { _all: 10 } },
      { status: "LOCKED", _count: { _all: 1 } },
      { status: "INACTIVE", _count: { _all: 1 } },
    ]);
    (mockPrisma.patient.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { branchId: 1, _count: { _all: 20 } },
      { branchId: 2, _count: { _all: 17 } },
    ]);
    (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, module: "USER", action: "USER_CREATED", tableName: "User", recordId: "5", ipAddress: "127.0.0.1", createdAt: new Date(), branch: { id: 1, name: "Main Branch" }, user: { id: 1, name: "Super", email: "super@hospital.com" } },
    ]);

    const stats = await superAdminService.getDashboardStats(actor);

    expect(stats.summary.branches.total).toBe(2);
    expect(stats.summary.users.total).toBe(12);
    expect(stats.summary.patients).toBe(37);
    expect(stats.summary.doctors).toBe(6);
    expect(stats.activity.auditEventsTotal).toBe(500);
    expect(stats.breakdown.usersByStatus).toEqual([
      { status: "ACTIVE", count: 10 },
      { status: "LOCKED", count: 1 },
      { status: "INACTIVE", count: 1 },
    ]);
    expect(stats.breakdown.patientsByBranch[0]).toEqual({
      branchId: 1,
      branchName: "Main Branch",
      count: 20,
    });
    expect(stats.recentActivity).toHaveLength(1);
    expect(stats.live).toBe(true);
    expect(stats.generatedAt).toBeTruthy();
  });
});