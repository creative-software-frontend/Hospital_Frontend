import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const prisma = {
    auditLog: { count: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) => arg),
  };
  return { prisma };
});

const mockPrisma = vi.mocked(await import("../lib/prisma")).prisma;

import * as auditService from "../modules/audit/audit.service";
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

const SAMPLE_ROW = {
  id: 1,
  userId: 2,
  branchId: 1,
  module: "AUTH",
  action: "LOGIN_SUCCESS",
  tableName: null,
  recordId: null,
  oldValues: null,
  newValues: null,
  ipAddress: "127.0.0.1",
  userAgent: null,
  createdAt: "2026-09-21T00:00:00.000Z",
  user: { id: 2, name: "Admin", email: "admin@hospital.com" },
  branch: { id: 1, name: "Main Branch", code: "MAIN" },
};

describe("audit.service — listAuditLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets SUPER_ADMIN see all branches (no branchId scoping)", async () => {
    (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([SAMPLE_ROW]);

    const result = await auditService.listAuditLogs(makeActor("SUPER_ADMIN"), {});

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        take: 20,
        skip: 0,
      }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it("scopes non-super users to their own branch", async () => {
    (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await auditService.listAuditLogs(makeActor("ADMIN"), {});

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 1 },
      }),
    );
  });

  it("applies module/action/userId/date filters (SUPER_ADMIN may also filter branchId)", async () => {
    (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await auditService.listAuditLogs(makeActor("SUPER_ADMIN"), {
      module: "user",
      action: "USER_CREATED",
      userId: 5,
      branchId: 3,
      from: new Date("2026-09-01"),
      to: new Date("2026-09-30"),
    });

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: 3,
          module: "user",
          action: "USER_CREATED",
          userId: 5,
          createdAt: { gte: new Date("2026-09-01"), lte: new Date("2026-09-30") },
        },
      }),
    );
  });

  it("normalizes pagination (page 2, limit capped at 100, correct skip)", async () => {
    (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(150);
    (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(Array.from({ length: 50 }));

    const result = await auditService.listAuditLogs(makeActor("ADMIN"), { page: 2, limit: 500 });

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 100 }),
    );
    expect(result.pagination.totalPages).toBe(2);
  });
});

describe("audit.service — exportAuditLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps the export at 5000 rows and applies branch scoping", async () => {
    (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await auditService.exportAuditLogs(makeActor("ADMIN"), { action: "LOGIN_FAILED" });

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 1, action: "LOGIN_FAILED" },
        take: 5000,
      }),
    );
  });
});