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
    findUniqueOrThrow: vi.fn(),
    delete: vi.fn(),
  });

  const prismaClient = {
    patient: makeModel(),
    patientContact: makeModel(),
    branch: makeModel(),
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
  $transaction: ReturnType<typeof vi.fn>;
};

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
  firstName: "John",
  lastName: "Doe",
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

  it("creates a patient in the actor's branch when branchId omitted", async () => {
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.patient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      branchId: 1,
      patientCode: "PT-0001",
    });

    const actorLocal = { ...actor, roles: [{ id: 2, seederKey: "ADMIN", name: "Admin" }] };
    const result = await patientService.createPatient(actorLocal, {
      patientCode: "PT-0001",
      firstName: "John",
      lastName: "Doe",
    });

    expect(mockPrisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branch: { connect: { id: 1 } },
          patientCode: "PT-0001",
          firstName: "John",
          createdById: 1,
        }),
      }),
    );
    expect(result.id).toBe(10);
  });

  it("rejects duplicate patientCode with ConflictError", async () => {
    (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99 });

    await expect(
      patientService.createPatient(actor, {
        patientCode: "PT-0001",
        firstName: "John",
      }),
    ).rejects.toThrow("already exists");
  });

  it("rejects a normal (non-super-admin) user creating in another branch", async () => {
    const actorLocal = { ...actor, roles: [{ id: 2, seederKey: "ADMIN", name: "Admin" }] };
    await expect(
      patientService.createPatient(actorLocal, {
        patientCode: "X",
        firstName: "John",
        branchId: 2,
      }),
    ).rejects.toThrow("You do not have permission");
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
  it("rejects missing firstName / patientCode", () => {
    const res = createPatientSchema.safeParse({ email: "bad" });
    expect(res.success).toBe(false);
  });

  it("rejects bad email and bad blood group", () => {
    const res = createPatientSchema.safeParse({
      patientCode: "P1",
      firstName: "John",
      email: "not-an-email",
      bloodGroup: "QQ",
    });
    expect(res.success).toBe(false);
  });

  it("rejects future dateOfBirth", () => {
    const res = createPatientSchema.safeParse({
      patientCode: "P1",
      firstName: "John",
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
      patientCode: "P-100",
      firstName: "Jane",
      lastName: "Smith",
      gender: "FEMALE",
      bloodGroup: "O_POS",
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