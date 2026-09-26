import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const prisma = {
    masterData: { findMany: vi.fn(), findFirst: vi.fn() },
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

interface MasterRow {
  category: string;
  code: string;
  label: string;
  parentCode: string | null;
}

const mdRow = (category: string, code: string, label: string, parentCode: string | null): MasterRow => ({
  category,
  code,
  label,
  parentCode,
});

/**
 * Answers masterData.findFirst the way Prisma does: filter by category, match
 * the value against either `code` or `label`, and constrain the parent only
 * when the service passed one.
 */
function stubRows(rows: MasterRow[]) {
  mockPrisma.masterData.findFirst.mockImplementation((async (args: any) => {
    const where = args?.where ?? {};
    const wanted: string[] = Array.isArray(where.OR)
      ? where.OR.map((o: { code?: string; label?: string }) => o.code ?? o.label)
      : [where.code];
    return (
      rows.find(
        (r) =>
          r.category === where.category &&
          (wanted.includes(r.code) || wanted.includes(r.label)) &&
          (where.parentCode === undefined || r.parentCode === where.parentCode),
      ) ?? null
    );
  }) as never);
}

const DIV_DHAKA = mdRow("divisions", "DIV_DHAKA", "Dhaka", null);
const DIV_CHATTOGRAM = mdRow("divisions", "DIV_CHATTOGRAM", "Chattogram", null);
const DST_DHAKA = mdRow("districts", "DST_DHAKA", "Dhaka", "DIV_DHAKA");
const DST_CHATTOGRAM = mdRow("districts", "DST_CHATTOGRAM", "Chattogram", "DIV_CHATTOGRAM");
const UPA_DHAKA_SAVAR = mdRow("upazilas", "UPA_DHAKA_SAVAR", "Savar", "DST_DHAKA");
const THA_DHAKA_GULSHAN = mdRow("thanas", "THA_DHAKA_GULSHAN", "Gulshan", "DST_DHAKA");
const THA_CHATTOGRAM_KOTWALI = mdRow("thanas", "THA_CHATTOGRAM_KOTWALI", "Kotwali", "DST_CHATTOGRAM");

describe("address cascade listing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only top-level divisions", async () => {
    mockPrisma.masterData.findMany.mockResolvedValueOnce([DIV_DHAKA] as never);

    const items = await settingService.listDivisions(actor);

    expect(mockPrisma.masterData.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 1, category: "divisions", status: "active", parentCode: null },
      }),
    );
    expect(items).toEqual([{ code: "DIV_DHAKA", label: "Dhaka" }]);
  });

  it("lists districts belonging to the given division", async () => {
    mockPrisma.masterData.findMany.mockResolvedValueOnce([
      DST_DHAKA,
      mdRow("districts", "DST_TANGAIL", "Tangail", "DIV_DHAKA"),
    ] as never);

    const items = await settingService.listDistricts(actor, "DIV_DHAKA");

    expect(mockPrisma.masterData.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 1, category: "districts", status: "active", parentCode: "DIV_DHAKA" },
      }),
    );
    expect(items.map((i) => i.label)).toEqual(["Dhaka", "Tangail"]);
  });

  it("returns thanas and upazilas together, each tagged with its kind", async () => {
    mockPrisma.masterData.findMany
      .mockResolvedValueOnce([UPA_DHAKA_SAVAR] as never)
      .mockResolvedValueOnce([THA_DHAKA_GULSHAN] as never);

    const items = await settingService.listLocalities(actor, "DST_DHAKA");

    expect(items).toEqual([
      { code: "THA_DHAKA_GULSHAN", label: "Gulshan", type: "thana" },
      { code: "UPA_DHAKA_SAVAR", label: "Savar", type: "upazila" },
    ]);
  });
});

describe("address chain validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a full valid chain and returns labels", async () => {
    stubRows([DIV_DHAKA, DST_DHAKA, UPA_DHAKA_SAVAR]);

    await expect(
      settingService.assertAddressChain(actor, {
        division: "DIV_DHAKA",
        district: "DST_DHAKA",
        upazila: "UPA_DHAKA_SAVAR",
      }),
    ).resolves.toEqual({
      division: "Dhaka",
      district: "Dhaka",
      upazila: "Savar",
      thana: null,
    });
  });

  it("rejects an upazila that belongs to a different district", async () => {
    stubRows([DIV_CHATTOGRAM, DST_CHATTOGRAM, UPA_DHAKA_SAVAR]);

    await expect(
      settingService.assertAddressChain(actor, {
        division: "DIV_CHATTOGRAM",
        district: "DST_CHATTOGRAM",
        upazila: "UPA_DHAKA_SAVAR",
      }),
    ).rejects.toThrow(/does not belong to district "Chattogram"/);
  });

  it("rejects a district that belongs to a different division", async () => {
    stubRows([DIV_DHAKA, DST_CHATTOGRAM]);

    await expect(
      settingService.assertAddressChain(actor, {
        division: "DIV_DHAKA",
        district: "DST_CHATTOGRAM",
      }),
    ).rejects.toThrow(/district "DST_CHATTOGRAM" does not belong to division "Dhaka"/);
  });

  it("rejects choosing both an upazila and a thana", async () => {
    await expect(
      settingService.assertAddressChain(actor, {
        division: "DIV_DHAKA",
        district: "DST_DHAKA",
        upazila: UPA_DHAKA_SAVAR.code,
        thana: THA_DHAKA_GULSHAN.code,
      }),
    ).rejects.toThrow(/either an upazila or a thana/);
  });

  it("rejects a locality with no district to hang it on", async () => {
    await expect(
      settingService.assertAddressChain(actor, { upazila: UPA_DHAKA_SAVAR.code }),
    ).rejects.toThrow(/district is required/);
  });

  it("derives the division from a legacy district that has no division", async () => {
    // Records created before the cascade hold a plain district label.
    stubRows([DIV_DHAKA, DST_DHAKA]);

    await expect(
      settingService.assertAddressChain(actor, { district: "Dhaka" }),
    ).resolves.toEqual({ division: "Dhaka", district: "Dhaka", upazila: null, thana: null });
  });

  it("resolves a legacy label for the locality too", async () => {
    stubRows([DIV_DHAKA, DST_DHAKA, UPA_DHAKA_SAVAR]);

    await expect(
      settingService.assertAddressChain(actor, { district: "Dhaka", upazila: "Savar" }),
    ).resolves.toEqual({ division: "Dhaka", district: "Dhaka", upazila: "Savar", thana: null });
  });

  it("accepts a thana as the locality", async () => {
    stubRows([DIV_DHAKA, DST_DHAKA, THA_DHAKA_GULSHAN]);

    await expect(
      settingService.assertAddressChain(actor, {
        division: "DIV_DHAKA",
        district: "DST_DHAKA",
        thana: "Gulshan",
      }),
    ).resolves.toEqual({ division: "Dhaka", district: "Dhaka", upazila: null, thana: "Gulshan" });
  });

  it("accepts a district on its own with no locality", async () => {
    stubRows([DIV_DHAKA, DST_DHAKA]);

    await expect(
      settingService.assertAddressChain(actor, { division: "DIV_DHAKA", district: "DST_DHAKA" }),
    ).resolves.toEqual({ division: "Dhaka", district: "Dhaka", upazila: null, thana: null });
  });

  it("rejects an unknown code that was never in master data", async () => {
    stubRows([DIV_DHAKA, DST_DHAKA]);

    await expect(
      settingService.assertAddressChain(actor, { division: "DIV_NOWHERE" }),
    ).rejects.toThrow(/Invalid division: DIV_NOWHERE/);
  });

  it("returns all nulls when no address is supplied", async () => {
    await expect(settingService.assertAddressChain(actor, {})).resolves.toEqual({
      division: null,
      district: null,
      upazila: null,
      thana: null,
    });
    expect(mockPrisma.masterData.findFirst).not.toHaveBeenCalled();
  });
});
