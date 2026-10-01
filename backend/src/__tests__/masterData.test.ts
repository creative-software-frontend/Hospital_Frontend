import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const delegate = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  });
  const prisma = {
    visitType: delegate(),
    bloodGroup: delegate(),
    documentType: delegate(),
    paymentMethod: delegate(),
    division: delegate(),
    district: delegate(),
    upazila: delegate(),
    union: delegate(),
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

/** The row shape the service selects: `name` is the new column behind `label`. */
const row = (code: string, name: string, sortOrder = 0) => ({ code, name, sortOrder });

const table = (model: string) =>
  (mockPrisma as unknown as Record<string, { findMany: ReturnType<typeof vi.fn> }>)[model];

describe("master data options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves configured master data and marks it as not a fallback", async () => {
    table("bloodGroup").findMany.mockResolvedValueOnce([
      row("O_NEG", "O-", 1),
      row("A_POS", "A+", 2),
    ] as never);

    const options = await settingService.listMasterDataOptions(actor, "blood_groups");

    expect(table("bloodGroup").findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 1, status: "active" },
      }),
    );
    expect(options.map((o) => o.code)).toEqual(["O_NEG", "A_POS"]);
    expect(options.every((o) => o.fallback === false)).toBe(true);
  });

  it("only returns active rows for the caller's branch", async () => {
    table("visitType").findMany.mockResolvedValueOnce([row("NEW", "New")] as never);

    await settingService.listMasterDataOptions(actor, "visit_types");

    expect(table("visitType").findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 1, status: "active" },
        select: { code: true, name: true, sortOrder: true },
      }),
    );
  });

  it("does not scope payment methods to a branch, because they are global", async () => {
    table("paymentMethod").findMany.mockResolvedValueOnce([row("CASH", "Cash")] as never);

    await settingService.listMasterDataOptions(actor, "payment_methods");

    expect(table("paymentMethod").findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "active" },
      }),
    );
  });

  it("falls back to the blood group enum when the category is empty", async () => {
    table("bloodGroup").findMany.mockResolvedValueOnce([] as never);

    const options = await settingService.listMasterDataOptions(actor, "blood_groups");

    expect(options).toHaveLength(8);
    expect(options.map((o) => o.code)).toContain("AB_NEG");
    expect(options.find((o) => o.code === "A_POS")?.label).toBe("A+");
    expect(options.every((o) => o.fallback === true)).toBe(true);
  });

  it("drops codes the database enum cannot store, then falls back", async () => {
    // A hand-edited or mis-typed row must not produce an unwritable value.
    table("bloodGroup").findMany.mockResolvedValueOnce([
      row("A_POS", "A+", 1),
      row("NOT_A_BLOOD_GROUP", "Bogus", 2),
    ] as never);

    const options = await settingService.listMasterDataOptions(actor, "blood_groups");

    expect(options.map((o) => o.code)).toEqual(["A_POS"]);
  });

  it("falls back when every configured code is invalid", async () => {
    table("bloodGroup").findMany.mockResolvedValueOnce([row("NOPE", "Nope", 1)] as never);

    const options = await settingService.listMasterDataOptions(actor, "blood_groups");

    expect(options).toHaveLength(8);
    expect(options.every((o) => o.fallback === true)).toBe(true);
  });

  it("uses the row code as the value, now that code is required on every table", async () => {
    table("visitType").findMany.mockResolvedValueOnce([
      row("NEW", "New", 1),
      row("FOLLOW_UP", "Follow-up", 2),
    ] as never);

    const options = await settingService.listMasterDataOptions(actor, "visit_types");

    expect(options.map((o) => o.code)).toEqual(["NEW", "FOLLOW_UP"]);
    expect(options.map((o) => o.label)).toEqual(["New", "Follow-up"]);
    expect(options.every((o) => o.fallback === false)).toBe(true);
  });

  it("returns nothing for a non-enum category that is empty, with no invented values", async () => {
    table("visitType").findMany.mockResolvedValueOnce([] as never);

    await expect(settingService.listMasterDataOptions(actor, "visit_types")).resolves.toEqual([]);
  });
});