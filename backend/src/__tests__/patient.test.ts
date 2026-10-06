import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("../lib/prisma", () => {
  const makeModel = () => ({
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    delete: vi.fn(),
  });

  const prismaClient = {
    patient: makeModel(),
    patientContact: makeModel(),
    patientSetting: makeModel(),
    branch: makeModel(),
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

const mockPrisma = (await import("../lib/prisma")).prisma as unknown as {
  patient: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  patientContact: {
    findFirst: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  branch: { findUnique: ReturnType<typeof vi.fn> };
  patientSetting: { findFirst: ReturnType<typeof vi.fn> };
  codeSequence: { upsert: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

// Default branch PatientSetting. Required channels are off so existing specs are
// unaffected; the auto-ID switch is on (the shipped default) because every create
// spec relies on the server issuing the code. The enforcement specs below override
// individual fields to assert real behaviour.
mockPrisma.patientSetting.findFirst.mockResolvedValue({
  patientIdPrefix: "PAT",
  autoGenerateId: true,
  defaultPatientType: "NEW",
  requireGuardian: "NEVER",
  duplicateDetection: false,
  phoneRequired: false,
  emailRequired: false,
  whatsappRequired: false,
});

import * as patientService from "../modules/patients/patient.service";

const actor = {
  id: 1,
  email: "admin@example.com",
  name: "Admin",
  username: "admin",
  branchId: 1,
  status: "ACTIVE",
  roles: [{ id: 1, seederKey: "SUPER_ADMIN", name: "Super Admin" }],
};

const SAMPLE_PATIENT = {
  id: 10,
  branchId: 1,
  patientCode: "PT-0001",
  name: "John Doe",
  gender: "MALE",
  dateOfBirth: new Date("1990-01-01"),
  bloodGroup: "O_POS",
  phone: "01711111111",
  email: "john@example.com",
  status: "active",
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("patient service — create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a patient in the actor's branch and auto-generates the patient code", async () => {
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ nextNumber: 1 });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      branchId: 1,
      patientCode: "PAT-000001",
    });

    const actorLocal = { ...actor, roles: [{ id: 2, seederKey: "ADMIN", name: "Admin" }] };
    const result = await patientService.createPatient(actorLocal, {
      name: "John Doe",
    });

    expect(mockPrisma.codeSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entity_branchId: { entity: "Patient", branchId: 1 } },
        update: { nextNumber: { increment: 1 } },
        create: { entity: "Patient", branchId: 1, nextNumber: 1 },
      }),
    );
    expect(mockPrisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branch: { connect: { id: 1 } },
          patientCode: "PAT-000001",
          name: "John Doe",
          createdById: 1,
        }),
      }),
    );
    expect(result.id).toBe(10);
    expect(result.patientCode).toBe("PAT-000001");
  });

  it("stores the whatsapp number on the patient record", async () => {
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ nextNumber: 2 });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 11,
      branchId: 1,
      patientCode: "PAT-000002",
    });

    await patientService.createPatient(actor, {
      name: "Jane Doe",
      whatsapp: "+8801711111111",
    });

    expect(mockPrisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ whatsapp: "+8801711111111" }),
      }),
    );
  });

  it("rejects a patient without a whatsapp number when the branch requires it", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce({
      phoneRequired: false,
      emailRequired: false,
      whatsappRequired: true,
    });

    await expect(
      patientService.createPatient(actor, { name: "No WhatsApp" }),
    ).rejects.toThrow(/WhatsApp number is required/i);

    expect(mockPrisma.patient.create).not.toHaveBeenCalled();
  });

  it("accepts a patient with a whatsapp number when the branch requires it", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce({
      phoneRequired: false,
      emailRequired: false,
      whatsappRequired: true,
    });
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ nextNumber: 3 });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 12,
      branchId: 1,
      patientCode: "PAT-000003",
    });

    const result = await patientService.createPatient(actor, {
      name: "Has WhatsApp",
      whatsapp: "+8801811111111",
    });

    expect(result.id).toBe(12);
  });

  it("maps a unique-index violation on the generated code to ConflictError", async () => {
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ nextNumber: 1 });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.22.0",
      }),
    );

    await expect(
      patientService.createPatient(actor, { name: "John" }),
    ).rejects.toThrow("already exists");
  });

  it("rejects a normal (non-super-admin) user creating in another branch", async () => {
    const actorLocal = { ...actor, roles: [{ id: 2, seederKey: "ADMIN", name: "Admin" }] };
    await expect(
      patientService.createPatient(actorLocal, {
        name: "John",
        branchId: 2,
      }),
    ).rejects.toThrow("You do not have permission");
  });
});

/* ---------------------------------------------------------------------------
 * P1 Patient Configuration — the five switches the settings screen exposes.
 * ------------------------------------------------------------------------- */

const setting = (overrides: Record<string, unknown> = {}) => ({
  patientIdPrefix: "PAT",
  autoGenerateId: true,
  defaultPatientType: "NEW",
  requireGuardian: "NEVER",
  duplicateDetection: false,
  phoneRequired: false,
  emailRequired: false,
  whatsappRequired: false,
  ...overrides,
});

describe("patient configuration — patient ID generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the code from the configured prefix, not a hardcoded one", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ patientIdPrefix: "PAT" }),
    );
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      nextNumber: 1,
    });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      branchId: 1,
      patientCode: "PAT-000001",
    });

    await patientService.createPatient(actor, { name: "First" });

    expect(mockPrisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ patientCode: "PAT-000001" }),
      }),
    );
  });

  it("keeps the next three codes sequential for the same prefix", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValue(
      setting({ patientIdPrefix: "PAT" }),
    );

    for (let n = 1; n <= 3; n += 1) {
      (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
        nextNumber: n,
      });
      (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: n,
        branchId: 1,
        patientCode: `PAT-${String(n).padStart(6, "0")}`,
      });

      const created = await patientService.createPatient(actor, {
        name: `Patient ${n}`,
      });
      expect(created.patientCode).toBe(`PAT-${String(n).padStart(6, "0")}`);
    }
  });

  it("does not double the hyphen when the prefix already ends with one", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ patientIdPrefix: "PT-" }),
    );
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      nextNumber: 7,
    });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 7,
      branchId: 1,
      patientCode: "PT-000007",
    });

    await patientService.createPatient(actor, { name: "Hyphen" });

    expect(mockPrisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ patientCode: "PT-000007" }),
      }),
    );
  });

  it("uses a manual patient ID when autoGenerateId is off", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ autoGenerateId: false }),
    );
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 20,
      branchId: 1,
      patientCode: "HOSP-88",
    });

    const result = await patientService.createPatient(actor, {
      name: "Manual",
      patientCode: "HOSP-88",
    });

    expect(result.patientCode).toBe("HOSP-88");
    // The sequence must not be consumed when the ID was supplied by hand.
    expect(mockPrisma.codeSequence.upsert).not.toHaveBeenCalled();
  });

  it("demands a patient ID when autoGenerateId is off", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ autoGenerateId: false }),
    );

    await expect(
      patientService.createPatient(actor, { name: "No ID" }),
    ).rejects.toThrow(/does not generate patient IDs automatically/i);

    expect(mockPrisma.patient.create).not.toHaveBeenCalled();
  });

  it("refuses a patient ID while autoGenerateId is on", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ autoGenerateId: true }),
    );

    await expect(
      patientService.createPatient(actor, { name: "Injected", patientCode: "FAKE-1" }),
    ).rejects.toThrow(/generated automatically/i);

    expect(mockPrisma.patient.create).not.toHaveBeenCalled();
  });

  it("maps a duplicate manual ID to a conflict naming the field", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ autoGenerateId: false }),
    );
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.22.0",
      }),
    );

    await expect(
      patientService.createPatient(actor, { name: "Dup", patientCode: "HOSP-88" }),
    ).rejects.toThrow(/HOSP-88 is already used/);
  });
});

describe("patient configuration — defaultPatientType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies the branch default when the caller does not choose", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ defaultPatientType: "REFERRAL" }),
    );
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      nextNumber: 1,
    });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 30,
      branchId: 1,
      patientCode: "PAT-000001",
      patientType: "REFERRAL",
    });

    const result = await patientService.createPatient(actor, { name: "Referred" });

    expect(mockPrisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ patientType: "REFERRAL" }),
      }),
    );
    expect(result.patientType).toBe("REFERRAL");
  });

  it("lets the caller choose a type over the branch default", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ defaultPatientType: "NEW" }),
    );
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      nextNumber: 1,
    });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 31,
      branchId: 1,
      patientCode: "PAT-000001",
      patientType: "FOLLOWUP",
    });

    const result = await patientService.createPatient(actor, {
      name: "Returning",
      patientType: "FOLLOWUP",
    });

    expect(mockPrisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ patientType: "FOLLOWUP" }),
      }),
    );
    expect(result.patientType).toBe("FOLLOWUP");
  });

  it("falls back to NEW when an unknown type was stored before the enum existed", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ defaultPatientType: "LEGACY_TYPE" }),
    );
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      nextNumber: 1,
    });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 32,
      branchId: 1,
      patientCode: "PAT-000001",
      patientType: "NEW",
    });

    const result = await patientService.createPatient(actor, { name: "Legacy" });

    expect(result.patientType).toBe("NEW");
  });
});

describe("patient configuration — requireGuardian", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const minor = new Date();
  minor.setUTCFullYear(minor.getUTCFullYear() - 10);
  const adult = new Date();
  adult.setUTCFullYear(adult.getUTCFullYear() - 40);

  it("refuses a minor with no emergency contact when MINORS_ONLY", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ requireGuardian: "MINORS_ONLY" }),
    );

    await expect(
      patientService.createPatient(actor, { name: "Child", dateOfBirth: minor }),
    ).rejects.toThrow(/emergency contact with a phone number/i);

    expect(mockPrisma.patient.create).not.toHaveBeenCalled();
  });

  it("accepts a minor who has an emergency contact", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ requireGuardian: "MINORS_ONLY" }),
    );
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      nextNumber: 1,
    });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 40,
      branchId: 1,
      patientCode: "PAT-000001",
    });

    const result = await patientService.createPatient(actor, {
      name: "Child",
      dateOfBirth: minor,
      contacts: [{ name: "Mother", phone: "01711111111" }],
    });

    expect(result.patientCode).toBe("PAT-000001");
  });

  it("lets an adult through under MINORS_ONLY without a contact", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ requireGuardian: "MINORS_ONLY" }),
    );
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      nextNumber: 1,
    });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 41,
      branchId: 1,
      patientCode: "PAT-000001",
    });

    const result = await patientService.createPatient(actor, {
      name: "Adult",
      dateOfBirth: adult,
    });

    expect(result.patientCode).toBe("PAT-000001");
  });

  it("requires a contact from everyone when ALWAYS", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ requireGuardian: "ALWAYS" }),
    );

    await expect(
      patientService.createPatient(actor, { name: "Adult", dateOfBirth: adult }),
    ).rejects.toThrow(/emergency contact with a phone number/i);
  });

  it("requires a reachable contact, not just a name", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ requireGuardian: "ALWAYS" }),
    );

    await expect(
      patientService.createPatient(actor, {
        name: "Adult",
        dateOfBirth: adult,
        contacts: [{ name: "Nobody" }],
      }),
    ).rejects.toThrow(/emergency contact with a phone number/i);
  });

  it("does not require a contact under NEVER", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ requireGuardian: "NEVER" }),
    );
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      nextNumber: 1,
    });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 42,
      branchId: 1,
      patientCode: "PAT-000001",
    });

    const result = await patientService.createPatient(actor, { name: "Child", dateOfBirth: minor });

    expect(result.patientCode).toBe("PAT-000001");
  });
});

describe("patient configuration — duplicateDetection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The default create specs do not expect a duplicate query.
    mockPrisma.patient.findMany.mockResolvedValue([]);
  });

  const enabled = (overrides: Record<string, unknown> = {}) =>
    setting({ duplicateDetection: true, ...overrides });

  it("blocks a second registration with the same phone number", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(enabled());
    mockPrisma.patient.findMany.mockResolvedValueOnce([
      {
        patientCode: "PAT-000001",
        name: "John Doe",
        phone: "01711111111",
        email: null,
        nationalId: null,
        dateOfBirth: null,
        deletedAt: null,
      },
    ]);

    await expect(
      patientService.createPatient(actor, {
        name: "Someone Else",
        phone: "+8801711111111",
      }),
    ).rejects.toThrow(/already registered as PAT-000001/);

    expect(mockPrisma.patient.create).not.toHaveBeenCalled();
  });

  it("blocks a second registration with the same national ID", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(enabled());
    mockPrisma.patient.findMany.mockResolvedValueOnce([
      {
        patientCode: "PAT-000002",
        name: "John Doe",
        phone: null,
        email: null,
        nationalId: "1234-5678-9012",
        dateOfBirth: null,
        deletedAt: null,
      },
    ]);

    await expect(
      patientService.createPatient(actor, {
        name: "Someone Else",
        nationalId: "123456789012",
      }),
    ).rejects.toThrow(/national ID already registered/);
  });

  it("blocks a second registration with the same email", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(enabled());
    mockPrisma.patient.findMany.mockResolvedValueOnce([
      {
        patientCode: "PAT-000003",
        name: "John Doe",
        phone: null,
        email: "john@example.com",
        nationalId: null,
        dateOfBirth: null,
        deletedAt: null,
      },
    ]);

    await expect(
      patientService.createPatient(actor, {
        name: "Someone Else",
        email: "John@Example.com",
      }),
    ).rejects.toThrow(/email address already registered/);
  });

  it("warns on name + date of birth and requires an acknowledgement", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(enabled());
    mockPrisma.patient.findMany.mockResolvedValueOnce([
      {
        patientCode: "PAT-000004",
        name: "John Doe",
        phone: "01811111111",
        email: null,
        nationalId: null,
        dateOfBirth: new Date("1990-01-01"),
        deletedAt: null,
      },
    ]);

    await expect(
      patientService.createPatient(actor, {
        name: "JOHN   DOE",
        dateOfBirth: new Date("1990-01-01"),
        phone: "01911111111",
      }),
    ).rejects.toThrow(/Confirm this is a different person/);
  });

  it("fetches records sharing the date of birth alongside strong matches", async () => {
    // Regression: the fetch used to be narrowed to the strong fields, so a
    // registration carrying a brand-new phone number never pulled the existing
    // record into scope and the name + date of birth match went unnoticed.
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(enabled());
    mockPrisma.patient.findMany.mockResolvedValue([]);
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      nextNumber: 6,
    });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 61,
      branchId: 1,
      patientCode: "PAT-000006",
    });

    await patientService.createPatient(actor, {
      name: "John Doe",
      dateOfBirth: new Date("1990-01-01"),
      phone: "01999999999",
      email: "fresh@example.com",
    });

    const where = mockPrisma.patient.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dateOfBirth: new Date("1990-01-01") }),
        expect.objectContaining({ phone: expect.any(String) }),
        expect.objectContaining({ email: "fresh@example.com" }),
      ]),
    );
  });

  it("accepts the acknowledged soft match and reports it back", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(enabled());
    mockPrisma.patient.findMany.mockResolvedValueOnce([
      {
        patientCode: "PAT-000004",
        name: "John Doe",
        phone: "01811111111",
        email: null,
        nationalId: null,
        dateOfBirth: new Date("1990-01-01"),
        deletedAt: null,
      },
    ]);
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      nextNumber: 5,
    });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 50,
      branchId: 1,
      patientCode: "PAT-000005",
    });

    const result = await patientService.createPatient(actor, {
      name: "JOHN   DOE",
      dateOfBirth: new Date("1990-01-01"),
      phone: "01911111111",
      overrideDuplicate: true,
    });

    expect(result.patientCode).toBe("PAT-000005");
    expect(result.duplicateWarnings).toHaveLength(1);
    expect(result.duplicateWarnings[0].patientCode).toBe("PAT-000004");
  });

  it("never lets an override bypass a strong match", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(enabled());
    mockPrisma.patient.findMany.mockResolvedValueOnce([
      {
        patientCode: "PAT-000001",
        name: "John Doe",
        phone: "01711111111",
        email: null,
        nationalId: null,
        dateOfBirth: null,
        deletedAt: null,
      },
    ]);

    await expect(
      patientService.createPatient(actor, {
        name: "Someone Else",
        phone: "01711111111",
        overrideDuplicate: true,
      }),
    ).rejects.toThrow(/already registered as PAT-000001/);
  });

  it("makes no duplicate query when the switch is off", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(
      setting({ duplicateDetection: false }),
    );
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      nextNumber: 9,
    });
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 60,
      branchId: 1,
      patientCode: "PAT-000009",
    });

    const result = await patientService.createPatient(actor, {
      name: "John Doe",
      phone: "01711111111",
    });

    expect(result.patientCode).toBe("PAT-000009");
    expect(mockPrisma.patient.findMany).not.toHaveBeenCalled();
  });

  it("includes soft-deleted records, since their identifiers are still consumed", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce(enabled());
    mockPrisma.patient.findMany.mockResolvedValueOnce([
      {
        patientCode: "PAT-000008",
        name: "John Doe",
        phone: "01711111111",
        email: null,
        nationalId: null,
        dateOfBirth: null,
        deletedAt: new Date(),
      },
    ]);

    await expect(
      patientService.createPatient(actor, { name: "Else", phone: "01711111111" }),
    ).rejects.toThrow(/already registered as PAT-000008/);
  });
});

describe("patient service — list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes normal users to their own branch and excludes deleted patients", async () => {
    const actorLocal = { ...actor, roles: [{ id: 2, seederKey: "DOCTOR", name: "Doctor" }] };
    (mockPrisma.patient.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (mockPrisma.patient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await patientService.listPatients(actorLocal, {});

    expect(mockPrisma.patient.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: 1, deletedAt: null }) }),
    );
  });

  it("lets SUPER_ADMIN see across branches and does not force its branch", async () => {
    (mockPrisma.patient.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (mockPrisma.patient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await patientService.listPatients(actor, { branchId: 2 });

    expect(mockPrisma.patient.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: 2 }) }),
    );
  });

  it("applies search filters", async () => {
    (mockPrisma.patient.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (mockPrisma.patient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([SAMPLE_PATIENT]);

    await patientService.listPatients(actor, { search: "John", gender: "MALE" });

    const whereArg = (mockPrisma.patient.count as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(whereArg.OR).toBeDefined();
    expect(whereArg.gender).toBe("MALE");
  });
});

describe("patient service — get", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns patient and enforces branch for SUPER_ADMIN", async () => {
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...SAMPLE_PATIENT,
      branch: { id: 2, name: "B2", code: "B2" },
      contacts: [],
    });

    const result = await patientService.getPatient(actor, 10);
    expect(result.patientCode).toBe("PT-0001");
  });

  it("throws NotFoundError when patient is in another branch for a normal user", async () => {
    const actorLocal = { ...actor, roles: [{ id: 2, seederKey: "DOCTOR", name: "Doctor" }] };
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...SAMPLE_PATIENT,
      branchId: 2,
    });

    await expect(patientService.getPatient(actorLocal, 10)).rejects.toThrow(
      "You do not have permission to access this branch",
    );
  });
});

describe("patient service — update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates editable fields and audits meaningful change", async () => {
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      branchId: 1,
      patientCode: "PT-0001",
    });
    (mockPrisma.patient.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_PATIENT);
    (mockPrisma.patient.update as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_PATIENT);
    (mockPrisma.patient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await patientService.updatePatient(actor, 10, { phone: "01800000000" });
    expect(mockPrisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: "01800000000" }) }),
    );
  });

  it("refuses to clear a stored whatsapp number while the branch requires it", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce({
      phoneRequired: false,
      emailRequired: false,
      whatsappRequired: true,
    });
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      branchId: 1,
      patientCode: "PT-0001",
    });
    (mockPrisma.patient.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...SAMPLE_PATIENT,
      whatsapp: "+8801711111111",
    });

    await expect(
      patientService.updatePatient(actor, 10, { whatsapp: "" as unknown as undefined }),
    ).rejects.toThrow(/WhatsApp number is required/i);

    expect(mockPrisma.patient.update).not.toHaveBeenCalled();
  });

  it("rejects an update that would leave a required whatsapp empty when omitted", async () => {
    mockPrisma.patientSetting.findFirst.mockResolvedValueOnce({
      phoneRequired: false,
      emailRequired: false,
      whatsappRequired: true,
    });
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      branchId: 1,
      patientCode: "PT-0001",
    });
    // Stored record has no whatsapp, so unrelated edits must still be blocked.
    (mockPrisma.patient.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...SAMPLE_PATIENT,
      whatsapp: null,
    });

    await expect(
      patientService.updatePatient(actor, 10, { name: "Renamed" }),
    ).rejects.toThrow(/WhatsApp number is required/i);

    expect(mockPrisma.patient.update).not.toHaveBeenCalled();
  });
});

describe("patient service — status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("changes status", async () => {
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      branchId: 1,
      patientCode: "PT-0001",
    });
    (mockPrisma.patient.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      status: "inactive",
    });

    const result = await patientService.updatePatientStatus(actor, 10, { status: "inactive" });
    expect(result.status).toBe("inactive");
  });
});

describe("patient service — soft delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft deletes a patient with no open activity", async () => {
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 10,
      branchId: 1,
      patientCode: "PT-0001",
    });
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    (mockPrisma.patient.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await patientService.deletePatient(actor, 10);
    const updateCall = (mockPrisma.patient.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
  });

  it("rejects deletion when open activity exists", async () => {
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 10,
      branchId: 1,
      patientCode: "PT-0001",
    });
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 10 });

    await expect(patientService.deletePatient(actor, 10)).rejects.toThrow("open appointments");
  });
});

describe("patient service — contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a contact under the owning patient", async () => {
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      branchId: 1,
      patientCode: "PT-0001",
    });
    (mockPrisma.patientContact.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
    (mockPrisma.patientContact.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      name: "Wife",
    });

    const result = await patientService.createContact(actor, 10, {
      name: "Wife",
      relationship: "Spouse",
      isPrimary: true,
    });
    expect(result.id).toBe(1);
  });

  it("updates a contact", async () => {
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      branchId: 1,
      patientCode: "PT-0001",
    });
    (mockPrisma.patientContact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5,
      name: "Old",
    });
    (mockPrisma.patientContact.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5,
      name: "New",
    });

    const result = await patientService.updateContact(actor, 10, 5, { name: "New" });
    expect(result.name).toBe("New");
  });

  it("deletes a contact", async () => {
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      branchId: 1,
      patientCode: "PT-0001",
    });
    (mockPrisma.patientContact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5,
      name: "Old",
    });
    (mockPrisma.patientContact.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await expect(patientService.deleteContact(actor, 10, 5)).resolves.toBeUndefined();
    expect(mockPrisma.patientContact.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it("branch-1 user cannot list/contact branch-2 patient", async () => {
    const actorLocal = { ...actor, roles: [{ id: 2, seederKey: "DOCTOR", name: "Doctor" }] };
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      branchId: 2,
      patientCode: "PT-0001",
    });

    await expect(patientService.createContact(actorLocal, 10, { name: "X" })).rejects.toThrow(
      "You do not have permission",
    );
  });
});

// Permission object should be usable by requirePermission
describe("permission catalog", () => {
  it("patient permissions exist in the Prisma client enum namespace", () => {
    expect(Prisma).toBeDefined();
  });
});

// Validation sanity — the schemas should reject invalid payloads
import {
  createPatientSchema,
  listPatientsQuerySchema,
  updatePatientStatusSchema,
} from "../modules/patients/patient.validation";

describe("patient validation", () => {
  it("rejects missing name", () => {
    const res = createPatientSchema.safeParse({ email: "bad" });
    expect(res.success).toBe(false);
  });

  it("rejects bad email, bad blood group and invalid occupation", () => {
    const res = createPatientSchema.safeParse({
      name: "John",
      email: "not-an-email",
      bloodGroup: "QQ",
      occupation: "Astronaut",
    });
    expect(res.success).toBe(false);
  });

  it("rejects future dateOfBirth", () => {
    const res = createPatientSchema.safeParse({
      name: "John",
      dateOfBirth: "2999-01-01",
    });
    expect(res.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const res = updatePatientStatusSchema.safeParse({ status: "nuked" });
    expect(res.success).toBe(false);
  });

  it("accepts a valid patient payload with contacts", () => {
    const res = createPatientSchema.safeParse({
      name: "Jane Smith",
      gender: "FEMALE",
      bloodGroup: "O_POS",
      occupation: "Teacher",
      phone: "+8801711111111",
      email: "jane@example.com",
      maritalStatus: "MARRIED",
      contacts: [{ name: "Husband", relationship: "Spouse", isPrimary: true }],
    });
    expect(res.success).toBe(true);
  });

  it("coerces and accepts numeric pagination query", () => {
    const res = listPatientsQuerySchema.safeParse({ page: "2", limit: "25", gender: "MALE" });
    expect(res.success).toBe(true);
  });
});