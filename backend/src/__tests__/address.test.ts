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

type Mock = {
  findMany: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
};

/** Every lookup delegate, keyed by model. Each level is its own table now. */
const table = (model: string) => (mockPrisma as unknown as Record<string, Mock>)[model];

/** A row as it comes back from Prisma on one address table. */
interface PlaceRow {
  id: number;
  branchId: number;
  name: string;
  code: string;
  sortOrder: number;
  status: string;
  bnName?: string | null;
  /** FK plus the parent relation the service selects alongside it. */
  [fk: string]: unknown;
}

const place = (
  model: string,
  code: string,
  name: string,
  extra: Record<string, unknown> = {},
  bnName: string | null = null,
): PlaceRow => ({
  id: model.length * 1000 + code.length,
  branchId: 1,
  name,
  code,
  sortOrder: 0,
  status: "active",
  bnName,
  ...extra,
});

const DIV_DHAKA = place("division", "DIV_DHAKA", "Dhaka");
const DIV_CHATTOGRAM = place("division", "DIV_CHATTOGRAM", "Chattogram");
const DST_DHAKA = place("district", "DST_DHAKA", "Dhaka", {
  divisionId: 10,
  division: { code: "DIV_DHAKA" },
});
const DST_CHATTOGRAM = place("district", "DST_CHATTOGRAM", "Chattogram", {
  divisionId: 11,
  division: { code: "DIV_CHATTOGRAM" },
});
const UPA_DHAKA_SAVAR = place("upazila", "UPA_DHAKA_SAVAR", "Savar", {
  districtId: 20,
  district: { code: "DST_DHAKA" },
});
const UPA_DHAKA_DHAMRAI = place("upazila", "UPA_DHAKA_DHAMRAI", "Dhamrai", {
  districtId: 20,
  district: { code: "DST_DHAKA" },
});
const UNI_UPA_DHAMRAI = place("union", "UNI_UPA_DHAMRAI_KAFRUL", "Kafrul", {
  upazilaId: 30,
  upazila: { code: "UPA_DHAKA_DHAMRAI" },
});

/** The relation filter the service passes per level, e.g. `{ division: { code } }`. */
const PARENT_RELATION: Record<string, { field: string; model: string }> = {
  district: { field: "divisionId", model: "division" },
  upazila: { field: "districtId", model: "district" },
  union: { field: "upazilaId", model: "upazila" },
};

/**
 * Answers each address table the way Prisma would: match the value against either
 * `code` or `name`, honour the branch, and constrain the parent only when the
 * service passed one.
 */
function stubRows(rows: PlaceRow[]) {
  const byModel = new Map<string, PlaceRow[]>();
  for (const model of Object.keys(PARENT_RELATION).concat("division")) {
    byModel.set(model, []);
  }
  for (const row of rows) {
    for (const [model, list] of byModel) {
      if (rowHasParent(model, row)) list.push(row);
    }
  }

  for (const [model, list] of byModel) {
    const parent = PARENT_RELATION[model];
    table(model).findFirst.mockImplementation((async (args: { where?: Record<string, any> }) => {
      const where = args?.where ?? {};
      const wanted: string[] = Array.isArray(where.OR)
        ? where.OR.map((o: { code?: string; name?: string }) => o.code ?? o.name)
        : [where.code];
      // The parent is now a real foreign key, so the constraint is an equality on
      // the relation rather than a string comparison.
      const parentCode = parent ? where[parent.model]?.code : undefined;

      const match = list.find(
        (r) =>
          (wanted.includes(r.code) || wanted.includes(r.name)) &&
          (parentCode === undefined ||
            parentCode === (r[parent!.model] as { code: string } | undefined)?.code),
      );
      return match ?? null;
    }) as never);
  }
}

/** True when a row belongs to `model`, judged by which FK it carries. */
function rowHasParent(model: string, row: PlaceRow): boolean {
  if (model === "division") return !("divisionId" in row) && !("districtId" in row) && !("upazilaId" in row);
  const parent = PARENT_RELATION[model];
  return parent.field in row;
}

describe("address cascade listing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only top-level divisions", async () => {
    table("division").findMany.mockResolvedValue([DIV_DHAKA] as never);

    const items = await settingService.listDivisions(actor);

    // A division has no parent, so there is no relation filter at all: the query is
    // simply "the active divisions of this branch".
    expect(table("division").findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 1, status: "active" },
      }),
    );
    expect(items).toEqual([{ code: "DIV_DHAKA", label: "Dhaka", bnName: null }]);
  });

  it("lists districts belonging to the given division", async () => {
    table("district").findMany.mockResolvedValue([
      DST_DHAKA,
      place("district", "DST_TANGAIL", "Tangail", { divisionId: 10, division: { code: "DIV_DHAKA" } }),
    ] as never);

    const items = await settingService.listDistricts(actor, "DIV_DHAKA");

    expect(table("district").findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 1, status: "active", division: { code: "DIV_DHAKA" } },
      }),
    );
    expect(items.map((i) => i.label)).toEqual(["Dhaka", "Tangail"]);
  });

  it("returns the upazilas as the locality level", async () => {
    // The dataset has no metropolitan thanas, so localities are upazilas only
    // and a single query covers the level.
    table("upazila").findMany.mockResolvedValue([UPA_DHAKA_SAVAR] as never);

    const items = await settingService.listLocalities(actor, "DST_DHAKA");

    expect(table("upazila").findMany).toHaveBeenCalledTimes(1);
    expect(items).toEqual([
      { code: "UPA_DHAKA_SAVAR", label: "Savar", bnName: null, type: "upazila" },
    ]);
  });

  it("passes the Bengali name through for the dropdown", async () => {
    table("division").findMany.mockResolvedValue([
      place("division", "DIV_DHAKA", "Dhaka", {}, "ঢাকা"),
    ] as never);

    const items = await settingService.listDivisions(actor);

    expect(items).toEqual([{ code: "DIV_DHAKA", label: "Dhaka", bnName: "ঢাকা" }]);
  });

  it("lists the unions under an upazila", async () => {
    table("union").findMany.mockResolvedValue([UNI_UPA_DHAMRAI] as never);

    const items = await settingService.listUnions(actor, "UPA_DHAKA_DHAMRAI");

    expect(table("union").findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 1,
          status: "active",
          upazila: { code: "UPA_DHAKA_DHAMRAI" },
        }),
      }),
    );
    expect(items).toEqual([
      { code: "UNI_UPA_DHAMRAI_KAFRUL", label: "Kafrul", bnName: null },
    ]);
  });

  it("refuses to list a child level with no parent, instead of dumping the branch", async () => {
    // Every district has a non-null divisionId, so "all districts in this branch"
    // is not a meaningful answer to a cascade request.
    await expect(settingService.listDistricts(actor)).resolves.toEqual([]);
    expect(table("district").findMany).not.toHaveBeenCalled();
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
        thana: "Gulshan",
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

  it("resolves a legacy thana against the upazila rows and clears thana", async () => {
    // A record saved before the upazila level took over as the thana still
    // carries `thana`. It is looked up in `upazilas` and stored there instead,
    // so the record cannot disagree with itself.
    stubRows([DIV_DHAKA, DST_DHAKA, UPA_DHAKA_SAVAR]);

    await expect(
      settingService.assertAddressChain(actor, {
        division: "DIV_DHAKA",
        district: "DST_DHAKA",
        thana: "Savar",
      }),
    ).resolves.toEqual({ division: "Dhaka", district: "Dhaka", upazila: "Savar", thana: null });
  });

  it("rejects a legacy thana that matches no upazila", async () => {
    stubRows([DIV_DHAKA, DST_DHAKA]);

    await expect(
      settingService.assertAddressChain(actor, {
        division: "DIV_DHAKA",
        district: "DST_DHAKA",
        thana: "Gulshan",
      }),
    ).rejects.toThrow(/thana "Gulshan" does not belong to district "Dhaka"/);
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
    for (const model of ["division", "district", "upazila", "union"]) {
      expect(table(model).findFirst).not.toHaveBeenCalled();
    }
  });
});