import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const prisma = {
    masterData: { findMany: vi.fn() },
  };
  return { prisma };
});

const mockPrisma = vi.mocked(await import("../lib/prisma")).prisma;

import * as settingService from "../modules/settings/setting.service";
import type { AuthUser } from "../types/auth";

const actor: AuthUser = {
  id: 2,
  email: "admin@hospital.com",
  name: "Admin",
  branchId: 1,
  status: "ACTIVE",
  roles: [{ id: 2, seederKey: "ADMIN", name: "Admin" }],
};

const row = (code: string, label: string, sortOrder = 0) => ({ code, label, sortOrder });

describe("master data options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves configured master data and marks it as not a fallback", async () => {
    mockPrisma.masterData.findMany.mockResolvedValueOnce([
      row("O_NEG", "O-", 1),
      row("A_POS", "A+", 2),
    ] as never);

    const options = await settingService.listMasterDataOptions(actor, "blood_groups");

    expect(mockPrisma.masterData.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 1, category: "blood_groups", status: "active" },
      }),
    );
    expect(options.map((o) => o.code)).toEqual(["O_NEG", "A_POS"]);
    expect(options.every((o) => o.fallback === false)).toBe(true);
  });

  it("only returns active rows for the caller's branch", async () => {
    mockPrisma.masterData.findMany.mockResolvedValueOnce([row("CASH", "Cash")] as never);

    await settingService.listMasterDataOptions(actor, "payment_methods");

    expect(mockPrisma.masterData.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 1, category: "payment_methods", status: "active" },
        select: { code: true, label: true, sortOrder: true },
      }),
    );
  });

  it("falls back to the blood group enum when the category is empty", async () => {
    mockPrisma.masterData.findMany.mockResolvedValueOnce([] as never);

    const options = await settingService.listMasterDataOptions(actor, "blood_groups");

    expect(options).toHaveLength(8);
    expect(options.map((o) => o.code)).toContain("AB_NEG");
    expect(options.find((o) => o.code === "A_POS")?.label).toBe("A+");
    expect(options.every((o) => o.fallback === true)).toBe(true);
  });

  it("drops codes the database enum cannot store, then falls back", async () => {
    // A hand-edited or mis-typed row must not produce an unwritable value.
    mockPrisma.masterData.findMany.mockResolvedValueOnce([
      row("A_POS", "A+", 1),
      row("NOT_A_BLOOD_GROUP", "Bogus", 2),
    ] as never);

    const options = await settingService.listMasterDataOptions(actor, "blood_groups");

    expect(options.map((o) => o.code)).toEqual(["A_POS"]);
  });

  it("falls back when every configured code is invalid", async () => {
    mockPrisma.masterData.findMany.mockResolvedValueOnce([
      row("NOPE", "Nope", 1),
    ] as never);

    const options = await settingService.listMasterDataOptions(actor, "blood_groups");

    expect(options).toHaveLength(8);
    expect(options.every((o) => o.fallback === true)).toBe(true);
  });

  it("uses the label as the value when a non-enum row has no code", async () => {
    // Seeded areas/districts carry no code, and the stored value is the label.
    mockPrisma.masterData.findMany.mockResolvedValueOnce([
      { code: null, label: "Dhanmondi", sortOrder: 0 },
      { code: null, label: "Gulshan", sortOrder: 0 },
    ] as never);

    const options = await settingService.listMasterDataOptions(actor, "areas");

    expect(options.map((o) => o.code)).toEqual(["Dhanmondi", "Gulshan"]);
    expect(options.map((o) => o.label)).toEqual(["Dhanmondi", "Gulshan"]);
    expect(options.every((o) => o.fallback === false)).toBe(true);
  });

  it("prefers an explicit code when one is set", async () => {
    mockPrisma.masterData.findMany.mockResolvedValueOnce([
      { code: "DMND", label: "Dhanmondi", sortOrder: 0 },
    ] as never);

    const options = await settingService.listMasterDataOptions(actor, "areas");

    expect(options.map((o) => o.code)).toEqual(["DMND"]);
    expect(options.map((o) => o.label)).toEqual(["Dhanmondi"]);
  });

  it("still refuses a code-less row for an enum-backed category", async () => {
    mockPrisma.masterData.findMany.mockResolvedValueOnce([
      { code: null, label: "Unknown", sortOrder: 0 },
    ] as never);

    const options = await settingService.listMasterDataOptions(actor, "blood_groups");

    expect(options).toHaveLength(8);
    expect(options.every((o) => o.fallback === true)).toBe(true);
  });

  it("returns nothing for a non-enum category that is empty, with no invented values", async () => {
    mockPrisma.masterData.findMany.mockResolvedValueOnce([] as never);

    await expect(settingService.listMasterDataOptions(actor, "areas")).resolves.toEqual([]);
  });
});
