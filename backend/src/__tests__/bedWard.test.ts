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
    bedDefinition: makeDelegate(),
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
      bedWardService.createBedWard(admin, "floors", { branchId: 1, name: "Ground" }),
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
      { id: 1, branchId: 3, name: "Ground" },
      { id: 2, branchId: 3, name: "First" },
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
    expect(args.where.OR).toEqual([
      { name: { contains: "f" } },
      { description: { contains: "f" } },
    ]);
  });

  it("searches only the fields a kind actually has", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.bedGroup.count).mockResolvedValue(0);
    asFn(mockPrisma.bedGroup.findMany).mockResolvedValue([]);

    await bedWardService.listBedWard(actor, "bed-groups", { search: "x" });

    const args = asFn(mockPrisma.bedGroup.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(args.where.OR).toEqual([
      { name: { contains: "x" } },
      { description: { contains: "x" } },
    ]);
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

  it("rejects create when the branch does not exist", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.branch.findUnique).mockResolvedValue(null);

    await expect(
      bedWardService.createBedWard(actor, "floors", { branchId: 99, name: "Ground" }),
    ).rejects.toThrow("Branch not found");
  });

  it("creates an item", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.branch.findUnique).mockResolvedValue({ id: 1 });
    asFn(mockPrisma.floor.create).mockResolvedValue({
      id: 5,
      branchId: 1,
      name: "Ground",
      description: null,
    });

    const row = await bedWardService.createBedWard(actor, "floors", {
      branchId: 1,
      name: "Ground",
    });

    expect(row.id).toBe(5);
    const createArgs = asFn(mockPrisma.floor.create).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({ branchId: 1, name: "Ground" });
  });

  it("routes each kind to its own model", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.branch.findUnique).mockResolvedValue({ id: 1 });
    asFn(mockPrisma.bedStatus.create).mockResolvedValue({
      id: 7,
      branchId: 1,
      name: "Available",
    });

    await bedWardService.createBedWard(actor, "bed-statuses", {
      branchId: 1,
      name: "Available",
    });

    expect(mockPrisma.bedStatus.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.floor.create).not.toHaveBeenCalled();
  });

  it("requires a floor when creating a bed group", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.branch.findUnique).mockResolvedValue({ id: 1 });
    asFn(mockPrisma.floor.findUnique).mockResolvedValue(null);

    await expect(
      bedWardService.createBedWard(actor, "bed-groups", {
        branchId: 1,
        name: "Ward A",
        floorId: 42,
      }),
    ).rejects.toThrow("Floor not found");
    expect(mockPrisma.bedGroup.create).not.toHaveBeenCalled();
  });

  it("rejects a relation pointing at another branch", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.branch.findUnique).mockResolvedValue({ id: 1 });
    asFn(mockPrisma.floor.findUnique).mockResolvedValue({ id: 42, branchId: 2 });

    await expect(
      bedWardService.createBedWard(actor, "bed-groups", {
        branchId: 1,
        name: "Ward A",
        floorId: 42,
      }),
    ).rejects.toThrow("Floor does not belong to this branch");
  });

  it("creates a bed with its type and group", async () => {
    const actor = makeActor("SUPER_ADMIN");
    asFn(mockPrisma.branch.findUnique).mockResolvedValue({ id: 1 });
    asFn(mockPrisma.bedType.findUnique).mockResolvedValue({ id: 3, branchId: 1 });
    asFn(mockPrisma.bedGroup.findUnique).mockResolvedValue({ id: 4, branchId: 1 });
    asFn(mockPrisma.bedDefinition.create).mockResolvedValue({
      id: 8,
      branchId: 1,
      name: "B-101",
      bedTypeId: 3,
      bedGroupId: 4,
      notAvailableForUse: false,
    });

    const row = await bedWardService.createBedWard(actor, "beds", {
      branchId: 1,
      name: "B-101",
      bedTypeId: 3,
      bedGroupId: 4,
    });

    expect(row.id).toBe(8);
    expect(mockPrisma.bedDefinition.create).toHaveBeenCalledTimes(1);
    const createArgs = asFn(mockPrisma.bedDefinition.create).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({ bedTypeId: 3, bedGroupId: 4, name: "B-101" });
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
    });
    asFn(mockPrisma.floor.update).mockResolvedValue({
      id: 1,
      branchId: 1,
      name: "Ground Floor",
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
