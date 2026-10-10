import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const makeModel = () => ({
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  });

  const prismaClient = {
    nurse: makeModel(),
    branch: makeModel(),
    department: makeModel(),
    shiftType: makeModel(),
    role: makeModel(),
    user: makeModel(),
    userRole: makeModel(),
    codeSequence: makeModel(),
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        // interactive transaction — tx is just the client mock itself
        return (arg as (tx: typeof prismaClient) => Promise<unknown>)(prismaClient);
      }
      if (Array.isArray(arg)) {
        const results = [];
        for (const fn of arg) {
          if (typeof fn === "function") results.push(await fn());
        }
        return results;
      }
      throw new Error("unsupported $transaction signature");
    }),
  };
  return { prisma: prismaClient };
});

vi.mock("../utils/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
}));

vi.mock("../modules/auth/auth.service", () => ({
  assertPasswordAcceptable: vi.fn(() => Promise.resolve()),
}));

const mockPrisma = (await import("../lib/prisma")).prisma as unknown as {
  nurse: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  branch: { findUnique: ReturnType<typeof vi.fn> };
  department: { findUnique: ReturnType<typeof vi.fn> };
  shiftType: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  role: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  userRole: { createMany: ReturnType<typeof vi.fn> };
  codeSequence: { upsert: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const { writeAuditLog } = await import("../utils/audit");
const auditMock = writeAuditLog as unknown as ReturnType<typeof vi.fn>;

import * as nurseService from "../modules/nurses/nurse.service";
import {
  createNurseSchema,
  updateNurseSchema,
  listNursesQuerySchema,
  nurseIdParamSchema,
} from "../modules/nurses/nurse.validation";
import { CODE_ENTITIES, formatBusinessCode } from "../utils/codeGenerator";

const superAdmin = {
  id: 1,
  email: "root@example.com",
  name: "Root",
  username: "root",
  branchId: 1,
  status: "ACTIVE",
  roles: [{ id: 1, seederKey: "SUPER_ADMIN", name: "Super Admin" }],
};

const nurseUser = {
  id: 9,
  email: "nurse01@clinic.test",
  name: "Sadia Rahman",
  username: "nurse01",
  branchId: 1,
  status: "ACTIVE",
  roles: [{ id: 9, seederKey: "NURSE", name: "Nurse" }],
};

const SAMPLE_NURSE = {
  id: 3,
  userId: null,
  branchId: 1,
  departmentId: 7,
  shiftTypeId: 2,
  nurseCode: "NUR-000001",
  name: "Sadia Rahman",
  qualification: "BSC in Nursing",
  registrationNo: "RN-7788",
  phone: "+8801811000000",
  email: "sadia.rahman@clinic.test",
  status: "active",
  createdAt: new Date("2026-02-01T09:00:00Z"),
  updatedAt: new Date("2026-02-01T09:00:00Z"),
};

const VALID_INPUT = {
  name: "Sadia Rahman",
  departmentId: 7,
  shiftTypeId: 2,
  qualification: "BSC in Nursing",
  registrationNo: "RN-7788",
  phone: "+8801811000000",
  email: "sadia.rahman@clinic.test",
  password: "Str0ng!pass",
  confirmPassword: "Str0ng!pass",
};

// `nurse.findFirst` is used for two different things: the access probe, which
// selects only id/branchId, and the follow-up read of the whole record. Mocking
// by argument shape instead of by call order keeps these tests independent of
// how many reads a given code path happens to make.
function mockNurseReads(options: { branchId?: number; exists?: boolean } = {}) {
  const branchId = options.branchId ?? 1;
  const exists = options.exists ?? true;
  mockPrisma.nurse.findFirst.mockReset();
  mockPrisma.nurse.findFirst.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
    // A missing or soft-deleted nurse must fail the access probe too, which is
    // what turns into the "Nurse not found" error.
    if (!exists) return null;
    const select = args?.select;
    const isAccessProbe = !!select && "branchId" in select && !("nurseCode" in select);
    return isAccessProbe ? { id: 3, branchId } : SAMPLE_NURSE;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.branch.findUnique.mockResolvedValue({ id: 1 });
  mockPrisma.department.findUnique.mockResolvedValue({ id: 7 });
  mockPrisma.shiftType.findUnique.mockResolvedValue({ id: 2 });
  mockPrisma.shiftType.findMany.mockResolvedValue([]);
  // Account creation is mandatory now, so every createNurse call goes through
  // the role lookup, email conflict check, username derivation and user write.
  mockPrisma.role.findUnique.mockResolvedValue({ id: 20, seederKey: "NURSE" });
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.user.create.mockResolvedValue({ id: 88 });
  mockPrisma.userRole.createMany.mockResolvedValue({ count: 1 });
  mockPrisma.codeSequence.upsert.mockResolvedValue({ nextNumber: 1 });
  mockPrisma.nurse.create.mockResolvedValue(SAMPLE_NURSE);
  mockPrisma.nurse.count.mockResolvedValue(0);
  mockPrisma.nurse.findMany.mockResolvedValue([]);
  mockPrisma.nurse.update.mockResolvedValue(SAMPLE_NURSE);
  mockNurseReads();
});

describe("createNurse", () => {
  it("creates the nurse with a NUR- code scoped to the actor's branch", async () => {
    const row = await nurseService.createNurse(nurseUser, VALID_INPUT);

    expect(row).toEqual(SAMPLE_NURSE);
    expect(CODE_ENTITIES.NURSE).toBe("Nurse");
    expect(formatBusinessCode("NUR", 1)).toBe("NUR-000001");

    expect(mockPrisma.codeSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entity_branchId: { entity: "Nurse", branchId: 1 } },
        create: { entity: "Nurse", branchId: 1, nextNumber: 1 },
      }),
    );

    const call = mockPrisma.nurse.create.mock.calls[0][0];
    expect(call.data.branchId).toBe(1);
    expect(call.data.name).toBe("Sadia Rahman");
    expect(call.data.nurseCode.startsWith("NUR")).toBe(true);
  });

  it("never takes the branch from the payload", async () => {
    await nurseService.createNurse(nurseUser, {
      ...VALID_INPUT,
      ...({ branchId: 999 } as Record<string, unknown>),
    });

    expect(mockPrisma.nurse.create.mock.calls[0][0].data.branchId).toBe(1);
  });

  it("applies defaults for the optional fields", async () => {
    await nurseService.createNurse(nurseUser, {
      name: "Nurse Minimal",
      email: "nurse.minimal@clinic.test",
      password: "Str0ng!pass",
      confirmPassword: "Str0ng!pass",
    });

    const call = mockPrisma.nurse.create.mock.calls[0][0];
    expect(call.data.status).toBe("active");
    expect(call.data.departmentId).toBeNull();
    expect(call.data.shiftTypeId).toBeNull();
  });

  it("stores a supplied status instead of the default", async () => {
    await nurseService.createNurse(nurseUser, {
      name: "Nurse On Leave",
      email: "leave@clinic.test",
      password: "Str0ng!pass",
      confirmPassword: "Str0ng!pass",
      status: "inactive",
    });

    expect(mockPrisma.nurse.create.mock.calls[0][0].data.status).toBe("inactive");
  });

  it("rejects creation when the actor's branch does not exist", async () => {
    mockPrisma.branch.findUnique.mockResolvedValue(null);

    await expect(nurseService.createNurse(nurseUser, VALID_INPUT)).rejects.toThrow(/Branch not found/i);
    expect(mockPrisma.nurse.create).not.toHaveBeenCalled();
  });

  it("rejects a department that does not exist", async () => {
    mockPrisma.department.findUnique.mockResolvedValue(null);

    await expect(
      nurseService.createNurse(nurseUser, {
        name: "Nurse",
        departmentId: 4242,
        email: "dept@clinic.test",
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
      }),
    ).rejects.toThrow(/Department not found/i);
    expect(mockPrisma.nurse.create).not.toHaveBeenCalled();
  });

  it("rejects a shift type that does not exist", async () => {
    mockPrisma.shiftType.findUnique.mockResolvedValue(null);

    await expect(
      nurseService.createNurse(nurseUser, {
        name: "Nurse",
        shiftTypeId: 999,
        email: "shift@clinic.test",
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
      }),
    ).rejects.toThrow(/Shift type not found/i);
    expect(mockPrisma.nurse.create).not.toHaveBeenCalled();
  });

  it("skips the reference lookups when both are omitted", async () => {
    await nurseService.createNurse(nurseUser, {
      name: "Nurse Bare",
      email: "bare@clinic.test",
      password: "Str0ng!pass",
      confirmPassword: "Str0ng!pass",
    });

    expect(mockPrisma.department.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.shiftType.findUnique).not.toHaveBeenCalled();
  });

  it("rejects creation without a password", async () => {
    await expect(
      nurseService.createNurse(nurseUser, {
        name: "Nurse No Login",
        email: "nologin@clinic.test",
        departmentId: null,
        shiftTypeId: null,
      }),
    ).rejects.toThrow(/Password is required/i);
    expect(mockPrisma.nurse.create).not.toHaveBeenCalled();
  });

  it("does not create the nurse when code generation fails inside the transaction", async () => {
    mockPrisma.codeSequence.upsert.mockRejectedValue(new Error("sequence locked"));

    await expect(nurseService.createNurse(nurseUser, VALID_INPUT)).rejects.toThrow("sequence locked");
    expect(mockPrisma.nurse.create).not.toHaveBeenCalled();
  });

  it("writes an audit log with the new nurse's identity", async () => {
    await nurseService.createNurse(nurseUser, VALID_INPUT);

    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "nurse",
        action: "create",
        tableName: "Nurse",
        recordId: "3",
        newValues: expect.objectContaining({
          name: "Sadia Rahman",
          nurseCode: "NUR-000001",
        }),
      }),
    );
  });
});

describe("updateNurse", () => {
  it("updates the nurse inside the actor's own branch", async () => {
    const row = await nurseService.updateNurse(nurseUser, 3, { name: "Sadia R." });

    expect(row).toEqual(SAMPLE_NURSE);
    expect(mockPrisma.nurse.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { name: "Sadia R." },
    });
  });

  it("rejects an unknown nurse", async () => {
    mockNurseReads({ exists: false });

    await expect(nurseService.updateNurse(nurseUser, 999, { name: "Ghost" })).rejects.toThrow(
      /Nurse not found/i,
    );
    expect(mockPrisma.nurse.update).not.toHaveBeenCalled();
  });

  it("blocks a non super-admin from editing another branch's nurse", async () => {
    mockNurseReads({ branchId: 2 });

    await expect(nurseService.updateNurse(nurseUser, 3, { name: "Hijack" })).rejects.toThrow(
      /do not have permission/i,
    );
    expect(mockPrisma.nurse.update).not.toHaveBeenCalled();
  });

  it("lets a super-admin edit across branches", async () => {
    mockNurseReads({ branchId: 2 });

    await nurseService.updateNurse(superAdmin, 3, { name: "Approved" });

    expect(mockPrisma.nurse.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { name: "Approved" },
    });
  });

  it("never updates a soft-deleted nurse", async () => {
    mockNurseReads({ exists: false });

    await expect(nurseService.updateNurse(nurseUser, 3, { name: "Zombie" })).rejects.toThrow(
      /Nurse not found/i,
    );
    expect(mockPrisma.nurse.update).not.toHaveBeenCalled();
  });

  it("rejects moving a nurse into a department that does not exist", async () => {
    mockPrisma.department.findUnique.mockResolvedValue(null);

    await expect(
      nurseService.updateNurse(nurseUser, 3, { departmentId: 4242 }),
    ).rejects.toThrow(/Department not found/i);
    expect(mockPrisma.nurse.update).not.toHaveBeenCalled();
  });

  it("records the previous name and code in the audit trail", async () => {
    await nurseService.updateNurse(nurseUser, 3, { name: "Sadia R." });

    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "nurse",
        action: "update",
        recordId: "3",
        oldValues: { name: "Sadia Rahman", nurseCode: "NUR-000001" },
        newValues: { name: "Sadia R." },
      }),
    );
  });
});

describe("getNurse", () => {
  it("returns the nurse for the same branch", async () => {
    expect(await nurseService.getNurse(nurseUser, 3)).toEqual(SAMPLE_NURSE);
  });

  it("hides a nurse from another branch", async () => {
    mockNurseReads({ branchId: 2 });

    await expect(nurseService.getNurse(nurseUser, 3)).rejects.toThrow(/do not have permission/i);
  });

  it("reports a missing nurse as not found", async () => {
    mockNurseReads({ exists: false });

    await expect(nurseService.getNurse(nurseUser, 999)).rejects.toThrow(/Nurse not found/i);
  });
});

describe("listNurses", () => {
  it("always scopes the list to the actor's branch and hides deleted rows", async () => {
    await nurseService.listNurses(nurseUser, {});

    expect(mockPrisma.nurse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { branchId: 1, deletedAt: null } }),
    );
  });

  it("searches name, code, qualification and registration number together", async () => {
    await nurseService.listNurses(nurseUser, { search: "sadia" });

    expect(mockPrisma.nurse.findMany.mock.calls[0][0].where.OR).toEqual([
      { name: { contains: "sadia" } },
      { nurseCode: { contains: "sadia" } },
      { qualification: { contains: "sadia" } },
      { registrationNo: { contains: "sadia" } },
    ]);
  });

  it("applies the status, department and shift filters", async () => {
    await nurseService.listNurses(nurseUser, { status: "active", departmentId: 7, shiftTypeId: 2 });

    const where = mockPrisma.nurse.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("active");
    expect(where.departmentId).toBe(7);
    expect(where.shiftTypeId).toBe(2);
  });

  it("ignores a non-numeric department filter instead of querying nonsense", async () => {
    await nurseService.listNurses(nurseUser, { departmentId: "abc" as never });

    expect(mockPrisma.nurse.findMany.mock.calls[0][0].where).not.toHaveProperty("departmentId");
  });

  it("returns pagination metadata with the rows", async () => {
    mockPrisma.nurse.count.mockResolvedValue(12);
    mockPrisma.nurse.findMany.mockResolvedValue([SAMPLE_NURSE]);

    const result = await nurseService.listNurses(nurseUser, { page: 2, limit: 5 });

    expect(result.data).toEqual([SAMPLE_NURSE]);
    expect(result.pagination).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
    expect(mockPrisma.nurse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  it("reports zero pages for an empty result set", async () => {
    mockPrisma.nurse.count.mockResolvedValue(0);

    expect((await nurseService.listNurses(nurseUser, {})).pagination.totalPages).toBe(0);
  });
});

describe("listShiftTypes", () => {
  it("returns only active shift types, ordered by name", async () => {
    mockPrisma.shiftType.findMany.mockResolvedValue([
      { id: 1, name: "Night", startTime: "20:00", endTime: "08:00", graceMinutes: 10, status: "active" },
    ]);

    const rows = await nurseService.listShiftTypes();

    expect(rows).toHaveLength(1);
    expect(mockPrisma.shiftType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "active" }, orderBy: { name: "asc" } }),
    );
  });
});

describe("createNurseSchema", () => {
  const SCHEMA_BASE = {
    name: "Nurse Schema",
    email: "schema.nurse@clinic.test",
    password: "Str0ng!pass",
    confirmPassword: "Str0ng!pass",
  };

  it("requires a name", () => {
    expect(createNurseSchema.safeParse({}).success).toBe(false);
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, name: "   " }).success).toBe(false);
  });

  it("requires an email and a password on create, since a login account is mandatory", () => {
    expect(createNurseSchema.safeParse({ name: "Nurse Only Name" }).success).toBe(false);
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, email: undefined }).success).toBe(false);
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, password: undefined }).success).toBe(false);
  });

  it("rejects a name longer than 255 characters", () => {
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, name: "x".repeat(256) }).success).toBe(false);
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, name: "x".repeat(255) }).success).toBe(true);
  });

  it("lowercases the email and rejects a malformed one", () => {
    expect(createNurseSchema.parse({ ...SCHEMA_BASE, email: "Sadia@Clinic.TEST" }).email).toBe(
      "sadia@clinic.test",
    );
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects phone numbers with letters", () => {
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, phone: "01811abc000" }).success).toBe(false);
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, phone: "+880 1811-000000" }).success).toBe(true);
  });

  it("rejects a registration number longer than 64 characters", () => {
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, registrationNo: "x".repeat(65) }).success).toBe(false);
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, registrationNo: "x".repeat(64) }).success).toBe(true);
  });

  it("keeps a blank string for phone and free-text fields, which currently accept it", () => {
    // Same quirk as the doctor schema: the phone regex uses `*` and the plain
    // max-length string accepts "", so the `.or(empty -> undefined)` fallback is
    // never reached and an empty string is stored instead of NULL.
    const parsed = createNurseSchema.parse({
      ...SCHEMA_BASE,
      phone: "",
      qualification: "",
      registrationNo: "",
    });
    expect(parsed.phone).toBe("");
    expect(parsed.qualification).toBe("");
    expect(parsed.registrationNo).toBe("");
  });

  it("rejects an unknown status", () => {
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, status: "resigned" }).success).toBe(false);
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, status: "active" }).success).toBe(true);
  });

  it("coerces department and shift ids and rejects non-positive or fractional ones", () => {
    expect(createNurseSchema.parse({ ...SCHEMA_BASE, departmentId: "7", shiftTypeId: "2" })).toMatchObject({
      departmentId: 7,
      shiftTypeId: 2,
    });
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, departmentId: 0 }).success).toBe(false);
    expect(createNurseSchema.safeParse({ ...SCHEMA_BASE, shiftTypeId: 1.5 }).success).toBe(false);
  });

  it("strips an injected branchId so it can never reach the database", () => {
    expect(createNurseSchema.parse({ ...SCHEMA_BASE, branchId: 999 } as never)).not.toHaveProperty("branchId");
  });
});

describe("createNurseAccount", () => {
  beforeEach(() => {
    mockPrisma.role.findUnique.mockResolvedValue({ id: 20, seederKey: "NURSE" });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // no email conflict
      .mockResolvedValueOnce(null); // username candidate is free
    mockPrisma.user.create.mockResolvedValue({ id: 88 });
    mockPrisma.userRole.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.nurse.create.mockResolvedValue({ ...SAMPLE_NURSE, userId: 88 });
  });

  it("creates a linked login account with a derived username and a hashed password", async () => {
    const row = await nurseService.createNurse(nurseUser, VALID_INPUT);

    const userArgs = mockPrisma.user.create.mock.calls[0][0];
    expect(userArgs.data.username).toBe("sadia.rahman");
    expect(userArgs.data.email).toBe("sadia.rahman@clinic.test");
    expect(userArgs.data.password).not.toBe("Str0ng!pass");
    expect(userArgs.data.branchId).toBe(1);
    expect(userArgs.data.status).toBe("ACTIVE");
    expect(userArgs.data.passwordHistory).toEqual([userArgs.data.password]);

    expect(mockPrisma.userRole.createMany.mock.calls[0][0].data).toEqual([{ userId: 88, roleId: 20 }]);

    const nurseArgs = mockPrisma.nurse.create.mock.calls[0][0];
    expect(nurseArgs.data.userId).toBe(88);
    expect(row.userId).toBe(88);
  });

  it("derives a unique username when the local part collides", async () => {
    mockPrisma.user.findUnique
      .mockReset()
      .mockResolvedValueOnce(null) // email conflict check passes
      .mockResolvedValueOnce({ id: 99 }) // first username candidate is taken
      .mockResolvedValueOnce(null); // suffixed candidate is free

    await nurseService.createNurse(nurseUser, VALID_INPUT);

    expect(mockPrisma.user.create.mock.calls[0][0].data.username).toBe("sadia.rahman_2");
  });

  it("rejects when the email already belongs to another user", async () => {
    mockPrisma.user.findUnique.mockReset().mockResolvedValueOnce({ id: 5 });

    await expect(nurseService.createNurse(nurseUser, VALID_INPUT)).rejects.toThrow(
      /already exists/i,
    );
    expect(mockPrisma.nurse.create).not.toHaveBeenCalled();
  });

  it("rejects account creation without an email", async () => {
    mockPrisma.user.findUnique.mockReset().mockResolvedValue(null);

    await expect(
      nurseService.createNurse(nurseUser, {
        name: "Nurse No Email",
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
      }),
    ).rejects.toThrow(/Email is required/i);
    expect(mockPrisma.nurse.create).not.toHaveBeenCalled();
  });

  it("audits the account creation", async () => {
    await nurseService.createNurse(nurseUser, VALID_INPUT);

    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "nurse",
        action: "create",
        newValues: expect.objectContaining({ accountCreated: true, username: "sadia.rahman" }),
      }),
    );
  });
});

describe("createNurseSchema passwords", () => {
  it("rejects mismatched passwords", () => {
    const parsed = createNurseSchema.safeParse({
      name: "Nurse X",
      email: "nurse.x@clinic.test",
      password: "Str0ng!pass",
      confirmPassword: "Different2",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) => i.path.includes("confirmPassword") && /match/i.test(i.message)),
      ).toBe(true);
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(
      createNurseSchema.safeParse({
        name: "Nurse X",
        email: "nurse.x@clinic.test",
        password: "short",
      }).success,
    ).toBe(false);
  });

  it("requires an email and a password on create", () => {
    expect(createNurseSchema.safeParse({ name: "Nurse X" }).success).toBe(false);
    expect(
      createNurseSchema.safeParse({ name: "Nurse X", email: "n.x@clinic.test" }).success,
    ).toBe(false);
  });

  it("does not require passwords on update", () => {
    expect(updateNurseSchema.safeParse({ name: "Nurse X", email: "n.x@clinic.test" }).success).toBe(true);
  });
});

describe("updateNurseSchema", () => {
  it("allows a partial update, including clearing a reference", () => {
    expect(updateNurseSchema.safeParse({}).success).toBe(true);
    expect(updateNurseSchema.safeParse({ status: "inactive" }).success).toBe(true);
    expect(updateNurseSchema.safeParse({ departmentId: null, shiftTypeId: null }).success).toBe(true);
  });

  it("still validates the fields that are present", () => {
    expect(updateNurseSchema.safeParse({ name: "" }).success).toBe(false);
    expect(updateNurseSchema.safeParse({ email: "bad" }).success).toBe(false);
  });
});

describe("listNursesQuerySchema and nurseIdParamSchema", () => {
  it("coerces numeric query strings", () => {
    const parsed = listNursesQuerySchema.parse({
      page: "2",
      limit: "50",
      departmentId: "7",
      shiftTypeId: "2",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.departmentId).toBe(7);
    expect(parsed.shiftTypeId).toBe(2);
  });

  it("caps the page size at 100 and rejects invalid input", () => {
    expect(listNursesQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(listNursesQuerySchema.safeParse({ status: "unknown" }).success).toBe(false);
    expect(listNursesQuerySchema.safeParse({ sortOrder: "sideways" }).success).toBe(false);
  });

  it("requires a positive integer nurse id", () => {
    expect(nurseIdParamSchema.parse({ id: "12" }).id).toBe(12);
    expect(nurseIdParamSchema.safeParse({ id: "0" }).success).toBe(false);
    expect(nurseIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
  });
});
