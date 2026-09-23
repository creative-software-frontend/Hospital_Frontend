import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => ({
  prisma: {
    localizationSetting: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (arg: never) => arg),
  },
}));

vi.mock("../utils/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
}));

const mockPrisma = (await import("../lib/prisma")).prisma as unknown as {
  localizationSetting: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};
const auditMock = vi.mocked((await import("../utils/audit")).writeAuditLog);

import * as settingService from "../modules/settings/setting.service";
import { updateLocalizationSettingSchema } from "../modules/settings/setting.validation";
import type { AuthUser } from "../types/auth";

type LocRow = {
  id: number;
  branchId: number;
  language: string;
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  timeFormat: string;
  timezone: string;
  numberFormat: string | null;
  weekStartDay: number;
};

const SUPER_ADMIN: AuthUser = {
  id: 9,
  email: "super@hospital.com",
  name: "Super Admin",
  branchId: 1,
  status: "ACTIVE",
  roles: [{ id: 1, seederKey: "SUPER_ADMIN", name: "SUPER_ADMIN" }],
};

const ACTOR_BRANCH_2: AuthUser = { ...SUPER_ADMIN, id: 10, branchId: 2 };

function makeRow(branchId: number, currency = "BDT", currencySymbol = "৳"): LocRow {
  return {
    id: branchId,
    branchId,
    language: "English",
    currency,
    currencySymbol,
    dateFormat: "DD-MM-YYYY",
    timeFormat: "24h",
    timezone: "Asia/Dhaka",
    numberFormat: "en-US",
    weekStartDay: 1,
  };
}

const store: LocRow[] = [];
let nextId = 1;

beforeEach(() => {
  store.length = 0;
  nextId = 1;
  vi.clearAllMocks();

  mockPrisma.localizationSetting.findFirst.mockImplementation(
    (args?: { orderBy?: { id: string }; where?: { branchId?: number; language?: string } }) => {
      const search = args as { orderBy?: { id: string }; where?: { branchId?: number; language?: string } };
      if (search.orderBy) return Promise.resolve(store[0] ?? null);
      const { branchId, language } = search.where ?? {};
      return Promise.resolve(
        store.find((r) => r.branchId === branchId && r.language === language) ?? null,
      );
    },
  );

  mockPrisma.localizationSetting.create.mockImplementation((args: { data: Partial<LocRow> }) => {
    const row: LocRow = {
      id: nextId++,
      branchId: 1,
      language: "English",
      currency: "BDT",
      currencySymbol: "৳",
      dateFormat: "DD-MM-YYYY",
      timeFormat: "24h",
      timezone: "Asia/Dhaka",
      numberFormat: "en-US",
      weekStartDay: 1,
      ...args.data,
    };
    store.push(row);
    return Promise.resolve(row);
  });

  mockPrisma.localizationSetting.update.mockImplementation(
    (args: { where: { id: number }; data: Partial<LocRow> }) => {
      const index = store.findIndex((r) => r.id === args.where.id);
      if (index === -1) throw new Error("row not found");
      const row = { ...store[index], ...args.data };
      store[index] = row;
      return Promise.resolve(row);
    },
  );

  mockPrisma.localizationSetting.updateMany.mockImplementation(
    (args: { data: Partial<LocRow> }) => {
      for (const row of store) Object.assign(row, args.data);
      return Promise.resolve({ count: store.length });
    },
  );
});

describe("getLocalizationSetting (localization = single central currency source)", () => {
  it("returns the existing English row for the actor's branch", async () => {
    store.push(makeRow(1, "USD", "$"));
    store.push(makeRow(2, "USD", "$"));

    const result = await settingService.getLocalizationSetting(SUPER_ADMIN);

    expect(result).toEqual(store[0]);
    expect(result.currency).toBe("USD");
    expect(mockPrisma.localizationSetting.create).not.toHaveBeenCalled();
  });

  it("creates a missing branch row using the CURRENT central currency from existing rows", async () => {
    store.push(makeRow(1, "USD", "$"));

    const result = await settingService.getLocalizationSetting(ACTOR_BRANCH_2);

    expect(mockPrisma.localizationSetting.create).toHaveBeenCalledTimes(1);
    expect(result.currency).toBe("USD");
    expect(result.currencySymbol).toBe("$");
    const createData = mockPrisma.localizationSetting.create.mock.calls[0][0] as { data: LocRow };
    expect(createData.data.currency).toBe("USD");
  });

  it("falls back to BDT defaults when no localization rows exist yet", async () => {
    const result = await settingService.getLocalizationSetting(SUPER_ADMIN);

    expect(result.currency).toBe("BDT");
    expect(result.currencySymbol).toBe("৳");
  });
});

describe("updateLocalizationSetting (currency is central/global)", () => {
  it("changes the currency for the actor's row AND syncs it to every branch", async () => {
    store.push(makeRow(1, "BDT"));
    store.push(makeRow(2, "BDT"));
    store.push(makeRow(3, "BDT"));

    const result = await settingService.updateLocalizationSetting(SUPER_ADMIN, {
      currency: "USD",
      currencySymbol: "$",
    });

    expect(result.currency).toBe("USD");
    expect(mockPrisma.localizationSetting.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.localizationSetting.updateMany).toHaveBeenCalledWith({
      where: {},
      data: { currency: "USD", currencySymbol: "$" },
    });
    expect(store.every((r) => r.currency === "USD" && r.currencySymbol === "$")).toBe(true);
  });

  it("syncs currency even when only currencySymbol changes", async () => {
    store.push(makeRow(1, "USD", "$"));

    await settingService.updateLocalizationSetting(SUPER_ADMIN, { currencySymbol: "US$" });

    expect(mockPrisma.localizationSetting.updateMany).toHaveBeenCalledTimes(1);
    expect(store[0].currencySymbol).toBe("US$");
    expect(store[0].currency).toBe("USD");
  });

  it("does NOT touch other branches when a non-currency field changes", async () => {
    store.push(makeRow(1, "BDT"));
    store.push(makeRow(2, "BDT"));

    await settingService.updateLocalizationSetting(SUPER_ADMIN, { timezone: "UTC" });

    expect(mockPrisma.localizationSetting.updateMany).not.toHaveBeenCalled();
    expect(store.every((r) => r.currency === "BDT")).toBe(true);
  });

  it("writes an audit log with old/new currency values", async () => {
    store.push(makeRow(1, "BDT", "৳"));

    await settingService.updateLocalizationSetting(SUPER_ADMIN, { currency: "INR", currencySymbol: "₹" });

    expect(auditMock).toHaveBeenCalledTimes(1);
    const call = auditMock.mock.calls[0][0];
    expect(call.module).toBe("localizationSetting");
    expect(call.action).toBe("update");
    expect(call.tableName).toBe("LocalizationSetting");
    expect(call.oldValues).toMatchObject({ currency: "BDT", currencySymbol: "৳" });
    expect(call.newValues).toMatchObject({ currency: "INR", currencySymbol: "₹" });
  });
});

describe("updateLocalizationSettingSchema (single currency catalog, no client-invented codes)", () => {
  it("accepts a supported 3-letter code", () => {
    const parsed = updateLocalizationSettingSchema.safeParse({ currency: "USD", currencySymbol: "$" });
    expect(parsed.success).toBe(true);
  });

  it("rejects codes outside the Localization catalog", () => {
    const parsed = updateLocalizationSettingSchema.safeParse({ currency: "XYZ" });
    expect(parsed.success).toBe(false);
  });

  it("normalizes lowercase codes to uppercase before allow-list check", () => {
    const parsed = updateLocalizationSettingSchema.safeParse({ currency: "eur" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.currency).toBe("EUR");
  });

  it("rejects malformed (non-3-letter) currency values", () => {
    expect(updateLocalizationSettingSchema.safeParse({ currency: "BD" }).success).toBe(false);
    expect(updateLocalizationSettingSchema.safeParse({ currency: "B" }).success).toBe(false);
    expect(updateLocalizationSettingSchema.safeParse({ currency: "BDTT" }).success).toBe(false);
  });

  it("rejects an empty currency symbol", () => {
    expect(updateLocalizationSettingSchema.safeParse({ currencySymbol: "" }).success).toBe(false);
  });

  it("accepts non-currency localization fields", () => {
    const parsed = updateLocalizationSettingSchema.safeParse({
      language: "English",
      timeFormat: "24h",
      timezone: "Asia/Dhaka",
    });
    expect(parsed.success).toBe(true);
  });
});