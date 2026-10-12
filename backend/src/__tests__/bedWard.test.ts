import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const makeDelegate = () => ({
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  });
  const prisma = {
    floor: makeDelegate(),
    bedType: makeDelegate(),
    bedGroup: makeDelegate(),
    bedStatus: makeDelegate(),
    branch: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma };
});

vi.mock("../utils/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
}));

const mockPrisma = vi.mocked(await import("../lib/prisma")).prisma;

import * as bedWardService from "../modules/bedward/bedWard.service";
import type { AuthUser } from "../types/auth";

type Fn = ReturnType<typeof vi.fn>;
const asFn = (value: unknown): Fn => value as Fn;

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

describe("bedWard.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses non-SUPER_ADMIN users", async () => {
    const admin = makeActor("ADMIN");
    await expect(bedWardService.listBedWard(admin, "floors", {})).rejects.toThrow(
      "SUPER_ADMIN role required",
    );
    await expect(
      bedWardService.createBedWard(admin, "floors", { branchId: 1, name: "Ground", code: "GF" }),
    ).rejects.toThrow("SUPER_ADMIN role required");
    await expect(bedWardService.getBedWard(admin, "floors", 1)).rejects.toThrow(
      "SUPER_ADMIN role required",
    );
    await expect(
      bedWardService.updateBedWard(admin, "floors", 1, { name: "x" }),
    ).rejects.toThrow("SUPER_ADMIN role required");
  });

  it("lists rows with pagination and branch/search filters", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.floor.count).mockResolvedValue(2);
    asFn(mockPrisma.floor.findMany).mockResolvedValue([
      { id: 1, branchId: 3, name: "Ground", code: "GF" },
      { id: 2, branchId: 3, name: "First", code: "1F" },
    ]);

    const result = await bedWardService.listBedWard(actor, "floors", {
      branchId: 3,
      search: "f",
    });

    expect(result.pagination.total).toBe(2);
    expect(result.data).toHaveLength(2);

    const args = asFn(mockPrisma.floor.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
      orderBy: Record<string, string>;
    };
    expect(args.where.branchId).toBe(3);
    expect(args.where.OR).toBeDefined();
  });

  it("falls back to sorting by name for a non-existent sort field", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.floor.count).mockResolvedValue(0);
    asFn(mockPrisma.floor.findMany).mockResolvedValue([]);

    await bedWardService.listBedWard(actor, "floors", { sortBy: "username" });

    const args = asFn(mockPrisma.floor.findMany).mock.calls[0][0] as {
      orderBy: Record<string, string>;
    };
    expect(args.orderBy).toEqual({ name: "desc" });
  });

  it("rejects a duplicate code within the same branch", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.branch.findUnique).mockResolvedValue({ id: 1 });
    asFn(mockPrisma.floor.findFirst).mockResolvedValue({ id: 9 });

    await expect(
      bedWardService.createBedWard(actor, "floors", { branchId: 1, name: "Ground", code: "GF" }),
    ).rejects.toThrow('Floor code "GF" already exists in this branch');
  });

  it("rejects create when the branch does not exist", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.branch.findUnique).mockResolvedValue(null);

    await expect(
      bedWardService.createBedWard(actor, "floors", { branchId: 99, name: "Ground", code: "GF" }),
    ).rejects.toThrow("Branch not found");
  });

  it("creates an item", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.branch.findUnique).mockResolvedValue({ id: 1 });
    asFn(mockPrisma.floor.findFirst).mockResolvedValue(null);
    asFn(mockPrisma.floor.create).mockResolvedValue({
      id: 5,
      branchId: 1,
      name: "Ground",
      code: "GF",
      description: null,
    });

    const row = await bedWardService.createBedWard(actor, "floors", {
      branchId: 1,
      name: "Ground",
      code: "GF",
    });

    expect(row.id).toBe(5);
    const createArgs = asFn(mockPrisma.floor.create).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({ branchId: 1, name: "Ground", code: "GF" });
  });

  it("routes each kind to its own model", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.branch.findUnique).mockResolvedValue({ id: 1 });
    asFn(mockPrisma.bedStatus.findFirst).mockResolvedValue(null);
    asFn(mockPrisma.bedStatus.create).mockResolvedValue({
      id: 7,
      branchId: 1,
      name: "Available",
      code: "AVAILABLE",
      description: null,
      status: "active",
    });

    await bedWardService.createBedWard(actor, "bed-statuses", {
      branchId: 1,
      name: "Available",
      code: "AVAILABLE",
    });

    expect(mockPrisma.bedStatus.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.floor.create).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown id on get and update", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.floor.findUnique).mockResolvedValue(null);

    await expect(bedWardService.getBedWard(actor, "floors", 404)).rejects.toThrow(
      "Floor not found",
    );
    await expect(
      bedWardService.updateBedWard(actor, "floors", 404, { name: "x" }),
    ).rejects.toThrow("Floor not found");
  });

  it("updates an existing item", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.floor.findUnique).mockResolvedValue({
      id: 1,
      branchId: 1,
      name: "Ground",
      code: "GF",
    });
    asFn(mockPrisma.floor.update).mockResolvedValue({
      id: 1,
      branchId: 1,
      name: "Ground Floor",
      code: "GF",
      description: null,
    });

    const row = await bedWardService.updateBedWard(actor, "floors", 1, {
      name: "Ground Floor",
    });

    expect(row.name).toBe("Ground Floor");
    const updateArgs = asFn(mockPrisma.floor.update).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data).toEqual({ name: "Ground Floor" });
  });
});
