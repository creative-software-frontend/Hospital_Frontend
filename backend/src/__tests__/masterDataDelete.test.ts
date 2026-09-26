import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const prisma = {
    masterData: { findFirst: vi.fn(), count: vi.fn(), delete: vi.fn() },
    patient: { count: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma };
});

const mockPrisma = vi.mocked(await import("../lib/prisma")).prisma;
// The audit write is a side effect of the delete; the audit module has its own tests.
vi.mock("../utils/audit", () => ({ writeAuditLog: vi.fn() }));

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

const DIVISION = {
  id: 10,
  branchId: 1,
  category: "divisions",
  label: "Dhaka",
  code: "DIV_DHAKA",
  parentCode: null,
  sortOrder: 0,
  status: "active",
};

const DISTRICT = {
  id: 11,
  branchId: 1,
  category: "districts",
  label: "Dhaka",
  code: "DST_DHAKA",
  parentCode: "DIV_DHAKA",
  sortOrder: 0,
  status: "active",
};

const BLOOD_GROUP = {
  id: 12,
  branchId: 1,
  category: "blood_groups",
  label: "A+",
  code: "A_POS",
  parentCode: null,
  sortOrder: 0,
  status: "active",
};

describe("master data delete guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.masterData.delete.mockResolvedValue(undefined as never);
  });

  it("refuses to delete a division that still has districts filed under it", async () => {
    mockPrisma.masterData.findFirst.mockResolvedValue(DIVISION as never);
    mockPrisma.masterData.count.mockResolvedValue(13 as never);

    await expect(settingService.deleteMasterData(actor, 10)).rejects.toThrow(
      /still has 13 item\(s\) filed under it/,
    );
    expect(mockPrisma.masterData.delete).not.toHaveBeenCalled();
  });

  it("points at the inactive option rather than a dead end", async () => {
    mockPrisma.masterData.findFirst.mockResolvedValue(DIVISION as never);
    mockPrisma.masterData.count.mockResolvedValue(13 as never);

    await expect(settingService.deleteMasterData(actor, 10)).rejects.toThrow(/inactive/);
  });

  it("deletes a division once it has no children left", async () => {
    mockPrisma.masterData.findFirst.mockResolvedValue(DIVISION as never);
    mockPrisma.masterData.count.mockResolvedValue(0 as never);
    mockPrisma.patient.count.mockResolvedValue(0 as never);

    await settingService.deleteMasterData(actor, 10);

    expect(mockPrisma.masterData.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  it("refuses to delete an address row a patient address still names", async () => {
    mockPrisma.masterData.findFirst.mockResolvedValue(DISTRICT as never);
    mockPrisma.patient.count.mockResolvedValue(4 as never);

    await expect(settingService.deleteMasterData(actor, 11)).rejects.toThrow(
      /used by 4 patient record\(s\)/,
    );
    expect(mockPrisma.masterData.delete).not.toHaveBeenCalled();
  });

  it("checks patients against every address level", async () => {
    mockPrisma.masterData.findFirst.mockResolvedValue(DISTRICT as never);
    mockPrisma.patient.count.mockResolvedValue(0 as never);

    await settingService.deleteMasterData(actor, 11);

    expect(mockPrisma.patient.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          OR: expect.arrayContaining([
            { division: { in: ["Dhaka"] } },
            { district: { in: ["Dhaka"] } },
            { upazila: { in: ["Dhaka"] } },
            { thana: { in: ["Dhaka"] } },
          ]),
        }),
      }),
    );
    expect(mockPrisma.masterData.delete).toHaveBeenCalled();
  });

  it("leaves flat categories alone: no parent and no patient lookup", async () => {
    mockPrisma.masterData.findFirst.mockResolvedValue(BLOOD_GROUP as never);

    await settingService.deleteMasterData(actor, 12);

    expect(mockPrisma.masterData.count).not.toHaveBeenCalled();
    expect(mockPrisma.patient.count).not.toHaveBeenCalled();
    expect(mockPrisma.masterData.delete).toHaveBeenCalledWith({ where: { id: 12 } });
  });

  it("404s when the row is not in the actor's branch", async () => {
    mockPrisma.masterData.findFirst.mockResolvedValue(null as never);

    await expect(settingService.deleteMasterData(actor, 99)).rejects.toThrow(
      /Master data item not found/,
    );
    expect(mockPrisma.masterData.delete).not.toHaveBeenCalled();
  });
});
