import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => {
  // Every lookup list is its own delegate now, so all ten have to exist. `count`
  // and `patient` are here so the test can prove the delete path never calls them.
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
    city: delegate(),
    area: delegate(),
    visitType: delegate(),
    bloodGroup: delegate(),
    documentType: delegate(),
    paymentMethod: delegate(),
    division: delegate(),
    district: delegate(),
    upazila: delegate(),
    union: delegate(),
    patient: { count: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma };
});

const mockPrisma = vi.mocked(await import("../lib/prisma")).prisma;
// The audit write is a side effect of the delete; the audit module has its own tests.
vi.mock("../utils/audit", () => ({ writeAuditLog: vi.fn() }));

import * as settingService from "../modules/settings/setting.service";
import { LOOKUP_SPECS } from "../lib/masterDataRegistry";
import type { AuthUser } from "../types/auth";

const actor: AuthUser = {
  id: 2,
  email: "admin@hospital.com",
  name: "Admin",
  branchId: 1,
  status: "ACTIVE",
  roles: [{ id: 2, seederKey: "ADMIN", name: "Admin" }],
};

type Mock = {
  findFirst: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
};

/** Every delegate, keyed by Prisma model name. */
const table = (model: string) => (mockPrisma as unknown as Record<string, Mock>)[model];

const DIVISION = {
  id: 10,
  branchId: 1,
  name: "Dhaka",
  code: "DIV_DHAKA",
  sortOrder: 0,
  status: "active",
};

const DISTRICT = {
  id: 11,
  branchId: 1,
  name: "Dhaka",
  code: "DST_DHAKA",
  divisionId: 10,
  division: { code: "DIV_DHAKA" },
  sortOrder: 0,
  status: "active",
};

const BLOOD_GROUP = {
  id: 12,
  branchId: 1,
  name: "A+",
  code: "A_POS",
  sortOrder: 0,
  status: "active",
};

/** The Prisma model backing a category, so a test can mock the right delegate. */
const modelOf = (category: keyof typeof LOOKUP_SPECS) => LOOKUP_SPECS[category].model;

describe("master data delete guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    table("division").findFirst.mockResolvedValue(DIVISION as never);
    for (const category of Object.keys(LOOKUP_SPECS) as Array<keyof typeof LOOKUP_SPECS>) {
      table(modelOf(category)).delete.mockResolvedValue(undefined as never);
    }
  });

  it("refuses to delete any address row, whatever it has under it", async () => {
    await expect(settingService.deleteMasterData(actor, "divisions", 10)).rejects.toThrow(
      /is national address data and cannot be added, edited or deleted/,
    );
    expect(table("division").delete).not.toHaveBeenCalled();
  });

  it("refuses every level of the hierarchy, not just the parents", async () => {
    const cases = [
      ["divisions", "division", 10],
      ["districts", "district", 11],
      ["upazilas", "upazila", 13],
      ["unions", "union", 14],
    ] as const;

    for (const [category, model, id] of cases) {
      table(model).findFirst.mockResolvedValue({ ...DISTRICT, id } as never);
      await expect(settingService.deleteMasterData(actor, category, id)).rejects.toThrow(
        /is national address data/,
      );
      expect(table(model).delete).not.toHaveBeenCalled();
    }
  });

  it("rejects a category that no table backs", async () => {
    // `thanas` was dropped with the split. There is no longer a stray row that
    // could slip past the guard and become editable.
    await expect(settingService.deleteMasterData(actor, "thanas", 15)).rejects.toThrow(
      /Unknown master data category "thanas"/,
    );
  });

  it("points at the dataset and the import rather than a dead end", async () => {
    await expect(settingService.deleteMasterData(actor, "divisions", 10)).rejects.toThrow(
      /address-master-data\.sql/,
    );
  });

  it("leaves flat categories alone: no child count, no patient lookup", async () => {
    table("bloodGroup").findFirst.mockResolvedValue(BLOOD_GROUP as never);

    await settingService.deleteMasterData(actor, "blood_groups", 12);

    expect(table("bloodGroup").count).not.toHaveBeenCalled();
    expect(mockPrisma.patient.count).not.toHaveBeenCalled();
    expect(table("bloodGroup").delete).toHaveBeenCalledWith({ where: { id: 12 } });
  });

  it("scopes the lookup to the actor's branch", async () => {
    table("bloodGroup").findFirst.mockResolvedValue(BLOOD_GROUP as never);

    await settingService.deleteMasterData(actor, "blood_groups", 12);

    expect(table("bloodGroup").findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 12, branchId: 1 } }),
    );
  });

  it("does not scope payment methods to a branch, because they are global", async () => {
    table("paymentMethod").findFirst.mockResolvedValue({
      id: 20,
      name: "Cash",
      code: "CASH",
      sortOrder: 0,
      status: "active",
    } as never);

    await settingService.deleteMasterData(actor, "payment_methods", 20);

    expect(table("paymentMethod").findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 20 } }),
    );
    expect(table("paymentMethod").delete).toHaveBeenCalledWith({ where: { id: 20 } });
  });

  it("404s when the row is not in the actor's branch", async () => {
    table("division").findFirst.mockResolvedValue(null as never);

    await expect(settingService.deleteMasterData(actor, "divisions", 99)).rejects.toThrow(
      /Master data item not found/,
    );
    expect(table("division").delete).not.toHaveBeenCalled();
  });

  it("addresses the row in the category named in the path, not the first table with that id", async () => {
    // Ids are per-table, so a city and a division can both be id 1. Naming the
    // category must win: this deletes the city, not the division.
    table("city").findFirst.mockResolvedValue({
      id: 1,
      branchId: 1,
      name: "Dhaka",
      code: "DAC",
      sortOrder: 0,
      status: "active",
    } as never);

    await settingService.deleteMasterData(actor, "cities", 1);

    expect(table("city").delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(table("division").findFirst).not.toHaveBeenCalled();
    expect(table("division").delete).not.toHaveBeenCalled();
  });
});