import { describe, it, expect, vi, beforeEach } from "vitest";

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
  });

  const prismaClient = {
    doctor: makeModel(),
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
  doctor: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  branch: { findUnique: ReturnType<typeof vi.fn> };
  codeSequence: { upsert: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const { writeAuditLog } = await import("../utils/audit");
const auditMock = writeAuditLog as unknown as ReturnType<typeof vi.fn>;

import * as doctorService from "../modules/doctors/doctor.service";
import {
  createDoctorSchema,
  updateDoctorSchema,
  listDoctorsQuerySchema,
  doctorIdParamSchema,
} from "../modules/doctors/doctor.validation";
import { CODE_ENTITIES } from "../utils/codeGenerator";

const superAdmin = {
  id: 1,
  email: "root@example.com",
  name: "Root",
  username: "root",
  branchId: 1,
  status: "ACTIVE",
  roles: [{ id: 1, seederKey: "SUPER_ADMIN", name: "Super Admin" }],
};

const branchUser = {
  id: 7,
  email: "reception@clinic.test",
  name: "Reception",
  username: "reception",
  branchId: 1,
  status: "ACTIVE",
  roles: [{ id: 4, seederKey: "RECEPTIONIST", name: "Receptionist" }],
};

const SAMPLE_DOCTOR = {
  id: 55,
  userId: null,
  branchId: 1,
  departmentId: 3,
  doctorCode: "DOC-0001",
  name: "Dr. Sarah Ahmed",
  specialization: "Cardiology",
  qualification: "MBBS, FCPS",
  registrationNo: "REG-8891",
  phone: "+8801711000000",
  email: "sarah@clinic.test",
  consultationFee: "800.00",
  followupFee: "400.00",
  emergencyFee: "1200.00",
  commissionType: "PERCENT",
  commissionValue: "10.00",
  status: "active",
  createdAt: new Date("2026-01-05T10:00:00Z"),
  updatedAt: new Date("2026-01-05T10:00:00Z"),
};

const VALID_INPUT = {
  name: "Dr. Sarah Ahmed",
  departmentId: 3,
  specialization: "Cardiology",
  qualification: "MBBS, FCPS",
  registrationNo: "REG-8891",
  phone: "+8801711000000",
  email: "sarah@clinic.test",
  consultationFee: "800.00",
  followupFee: "400.00",
  emergencyFee: "1200.00",
  commissionType: "PERCENT" as const,
  commissionValue: "10.00",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.branch.findUnique.mockResolvedValue({ id: 1 });
  mockPrisma.codeSequence.upsert.mockResolvedValue({ nextNumber: 1 });
  mockPrisma.doctor.create.mockResolvedValue(SAMPLE_DOCTOR);
  mockPrisma.doctor.count.mockResolvedValue(0);
  mockPrisma.doctor.findMany.mockResolvedValue([]);
  mockPrisma.doctor.update.mockResolvedValue(SAMPLE_DOCTOR);
});

describe("createDoctor", () => {
  it("creates the doctor with a generated code scoped to the actor's branch", async () => {
    const row = await doctorService.createDoctor(branchUser, VALID_INPUT);

    expect(row).toEqual(SAMPLE_DOCTOR);
    expect(mockPrisma.codeSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entity_branchId: { entity: "Doctor", branchId: 1 } },
        create: { entity: "Doctor", branchId: 1, nextNumber: 1 },
      }),
    );
    expect(CODE_ENTITIES.DOCTOR).toBe("Doctor");

    const call = mockPrisma.doctor.create.mock.calls[0][0];
    expect(call.data.branchId).toBe(1);
    expect(call.data.name).toBe("Dr. Sarah Ahmed");
    expect(call.data.doctorCode).toEqual(expect.any(String));
    expect(call.data.doctorCode.startsWith("DOC")).toBe(true);
  });

  it("never takes the branch from the payload, so a doctor cannot be filed into another branch", async () => {
    await doctorService.createDoctor(branchUser, {
      ...VALID_INPUT,
      // A hostile client sends this; the schema strips it and the service
      // always uses the actor's own branch.
      ...({ branchId: 999 } as Record<string, unknown>),
    });

    const call = mockPrisma.doctor.create.mock.calls[0][0];
    expect(call.data.branchId).toBe(1);
    expect(call.data).not.toHaveProperty("doctorCode", 999);
  });

  it("applies defaults for the optional fields", async () => {
    await doctorService.createDoctor(branchUser, { name: "Dr. Minimal" });

    const call = mockPrisma.doctor.create.mock.calls[0][0];
    expect(call.data.status).toBe("active");
    expect(call.data.departmentId).toBeNull();
    expect(call.data.commissionType).toBeNull();
    expect(call.data.email).toBeUndefined();
  });

  it("stores a supplied status instead of the default", async () => {
    await doctorService.createDoctor(branchUser, { name: "Dr. On Leave", status: "inactive" });

    expect(mockPrisma.doctor.create.mock.calls[0][0].data.status).toBe("inactive");
  });

  it("rejects creation when the actor's branch does not exist", async () => {
    mockPrisma.branch.findUnique.mockResolvedValue(null);

    await expect(doctorService.createDoctor(branchUser, VALID_INPUT)).rejects.toThrow(
      /Branch not found/i,
    );
    expect(mockPrisma.doctor.create).not.toHaveBeenCalled();
  });

  it("does not create the doctor when code generation fails inside the transaction", async () => {
    mockPrisma.codeSequence.upsert.mockRejectedValue(new Error("sequence locked"));

    await expect(doctorService.createDoctor(branchUser, VALID_INPUT)).rejects.toThrow("sequence locked");
    expect(mockPrisma.doctor.create).not.toHaveBeenCalled();
  });

  it("writes an audit log with the new doctor's identity", async () => {
    await doctorService.createDoctor(branchUser, VALID_INPUT);

    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "doctor",
        action: "create",
        tableName: "Doctor",
        recordId: "55",
        newValues: expect.objectContaining({
          name: "Dr. Sarah Ahmed",
          doctorCode: "DOC-0001",
        }),
      }),
    );
  });
});

describe("updateDoctor", () => {
  beforeEach(() => {
    mockPrisma.doctor.findFirst
      .mockResolvedValueOnce({ id: 55, branchId: 1 })
      .mockResolvedValueOnce(SAMPLE_DOCTOR);
  });

  it("updates the doctor inside the actor's own branch", async () => {
    const row = await doctorService.updateDoctor(branchUser, 55, { name: "Dr. Sarah A." });

    expect(row).toEqual(SAMPLE_DOCTOR);
    expect(mockPrisma.doctor.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: { name: "Dr. Sarah A." },
    });
  });

  it("rejects an unknown doctor", async () => {
    mockPrisma.doctor.findFirst.mockReset().mockResolvedValue(null);

    await expect(doctorService.updateDoctor(branchUser, 999, { name: "Ghost" })).rejects.toThrow(
      /Doctor not found/i,
    );
    expect(mockPrisma.doctor.update).not.toHaveBeenCalled();
  });

  it("blocks a non super-admin from editing another branch's doctor", async () => {
    mockPrisma.doctor.findFirst.mockReset().mockResolvedValue({ id: 55, branchId: 2 });

    await expect(doctorService.updateDoctor(branchUser, 55, { name: "Hijack" })).rejects.toThrow(
      /do not have permission/i,
    );
    expect(mockPrisma.doctor.update).not.toHaveBeenCalled();
  });

  it("lets a super-admin edit across branches", async () => {
    mockPrisma.doctor.findFirst.mockReset().mockResolvedValue({ id: 55, branchId: 2 });

    await doctorService.updateDoctor(superAdmin, 55, { name: "Approved" });

    expect(mockPrisma.doctor.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: { name: "Approved" },
    });
  });

  it("never updates a soft-deleted doctor", async () => {
    mockPrisma.doctor.findFirst.mockReset().mockResolvedValue(null);

    await expect(doctorService.updateDoctor(branchUser, 55, { name: "Zombie" })).rejects.toThrow(
      /Doctor not found/i,
    );
    expect(mockPrisma.doctor.update).not.toHaveBeenCalled();
  });

  it("records the previous name and code in the audit trail", async () => {
    await doctorService.updateDoctor(branchUser, 55, { name: "Dr. Sarah A." });

    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "doctor",
        action: "update",
        recordId: "55",
        oldValues: { name: "Dr. Sarah Ahmed", doctorCode: "DOC-0001" },
        newValues: { name: "Dr. Sarah A." },
      }),
    );
  });
});

describe("getDoctor", () => {
  it("returns the doctor for the same branch", async () => {
    mockPrisma.doctor.findFirst
      .mockResolvedValueOnce({ id: 55, branchId: 1 })
      .mockResolvedValueOnce(SAMPLE_DOCTOR);

    const row = await doctorService.getDoctor(branchUser, 55);

    expect(row).toEqual(SAMPLE_DOCTOR);
  });

  it("hides a doctor from another branch", async () => {
    mockPrisma.doctor.findFirst.mockResolvedValue({ id: 55, branchId: 2 });

    await expect(doctorService.getDoctor(branchUser, 55)).rejects.toThrow(/do not have permission/i);
  });
});

describe("listDoctors", () => {
  it("always scopes the list to the actor's branch and hides deleted rows", async () => {
    await doctorService.listDoctors(branchUser, {});

    expect(mockPrisma.doctor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { branchId: 1, deletedAt: null } }),
    );
  });

  it("searches name, code, specialization and registration number together", async () => {
    await doctorService.listDoctors(branchUser, { search: "cardio" });

    const where = mockPrisma.doctor.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { name: { contains: "cardio" } },
      { doctorCode: { contains: "cardio" } },
      { specialization: { contains: "cardio" } },
      { registrationNo: { contains: "cardio" } },
    ]);
  });

  it("applies the status and department filters", async () => {
    await doctorService.listDoctors(branchUser, { status: "active", departmentId: 3 });

    const where = mockPrisma.doctor.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("active");
    expect(where.departmentId).toBe(3);
  });

  it("ignores a non-numeric department filter instead of querying nonsense", async () => {
    await doctorService.listDoctors(branchUser, { departmentId: "abc" as never });

    expect(mockPrisma.doctor.findMany.mock.calls[0][0].where).not.toHaveProperty("departmentId");
  });

  it("returns pagination metadata with the rows", async () => {
    mockPrisma.doctor.count.mockResolvedValue(45);
    mockPrisma.doctor.findMany.mockResolvedValue([SAMPLE_DOCTOR]);

    const result = await doctorService.listDoctors(branchUser, { page: 2, limit: 20 });

    expect(result.data).toEqual([SAMPLE_DOCTOR]);
    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
    expect(mockPrisma.doctor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
  });

  it("reports zero pages for an empty result set", async () => {
    mockPrisma.doctor.count.mockResolvedValue(0);

    const result = await doctorService.listDoctors(branchUser, {});

    expect(result.pagination.totalPages).toBe(0);
  });
});

describe("createDoctorSchema", () => {
  it("requires a name", () => {
    expect(createDoctorSchema.safeParse({}).success).toBe(false);
    expect(createDoctorSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("accepts a name on its own, since everything else is optional", () => {
    const parsed = createDoctorSchema.parse({ name: "Dr. Only Name" });
    expect(parsed.name).toBe("Dr. Only Name");
    expect(parsed.email).toBeUndefined();
  });

  it("rejects a name longer than 255 characters", () => {
    expect(createDoctorSchema.safeParse({ name: "x".repeat(256) }).success).toBe(false);
    expect(createDoctorSchema.safeParse({ name: "x".repeat(255) }).success).toBe(true);
  });

  it("lowercases the email and rejects a malformed one", () => {
    expect(createDoctorSchema.parse({ name: "A", email: "Sarah@Clinic.TEST" }).email).toBe(
      "sarah@clinic.test",
    );
    expect(createDoctorSchema.safeParse({ name: "A", email: "not-an-email" }).success).toBe(false);
  });

  it("rejects phone numbers with letters", () => {
    expect(createDoctorSchema.safeParse({ name: "A", phone: "01711abc000" }).success).toBe(false);
    expect(createDoctorSchema.safeParse({ name: "A", phone: "+880 1711-000000" }).success).toBe(true);
  });

  it("normalizes a blank string to 'no value' for the fields whose validator rejects empty input", () => {
    // email() and the fee regex both reject "", so the fallback branch wins and
    // the field becomes undefined.
    const parsed = createDoctorSchema.parse({
      name: "A",
      email: "",
      consultationFee: "",
    });
    expect(parsed.email).toBeUndefined();
    expect(parsed.consultationFee).toBeUndefined();
  });

  it("keeps a blank string for phone and free-text fields, which currently accept it", () => {
    // Documented quirk rather than a desired behaviour: the phone regex uses
    // `*` so "" matches, and the plain max-length string accepts "", so the
    // `.or(empty -> undefined)` fallback is never reached. The result is an
    // empty string in the column instead of NULL. Harmless today, but it means
    // "cleared" and "never set" are stored differently across these fields.
    const parsed = createDoctorSchema.parse({
      name: "A",
      phone: "",
      specialization: "",
      qualification: "",
      registrationNo: "",
    });
    expect(parsed.phone).toBe("");
    expect(parsed.specialization).toBe("");
    expect(parsed.qualification).toBe("");
    expect(parsed.registrationNo).toBe("");
  });

  it("accepts fees with up to two decimals and rejects anything else", () => {
    expect(createDoctorSchema.safeParse({ name: "A", consultationFee: "800" }).success).toBe(true);
    expect(createDoctorSchema.safeParse({ name: "A", consultationFee: "800.55" }).success).toBe(true);
    expect(createDoctorSchema.safeParse({ name: "A", consultationFee: "800.555" }).success).toBe(false);
    expect(createDoctorSchema.safeParse({ name: "A", consultationFee: "eight hundred" }).success).toBe(
      false,
    );
    expect(createDoctorSchema.safeParse({ name: "A", consultationFee: "-50" }).success).toBe(false);
  });

  it("rejects an unknown status or commission type", () => {
    expect(createDoctorSchema.safeParse({ name: "A", status: "retired" }).success).toBe(false);
    expect(createDoctorSchema.safeParse({ name: "A", commissionType: "SPLIT" }).success).toBe(false);
  });

  it("coerces a department id and rejects a non-integer one", () => {
    expect(createDoctorSchema.parse({ name: "A", departmentId: "3" }).departmentId).toBe(3);
    expect(createDoctorSchema.safeParse({ name: "A", departmentId: 0 }).success).toBe(false);
    expect(createDoctorSchema.safeParse({ name: "A", departmentId: 2.5 }).success).toBe(false);
  });

  it("strips an injected branchId so it can never reach the database", () => {
    const parsed = createDoctorSchema.parse({ name: "A", branchId: 999 } as never);
    expect(parsed).not.toHaveProperty("branchId");
  });
});

describe("updateDoctorSchema", () => {
  it("allows a partial update, including clearing a field", () => {
    expect(updateDoctorSchema.safeParse({}).success).toBe(true);
    expect(updateDoctorSchema.safeParse({ status: "inactive" }).success).toBe(true);
    expect(updateDoctorSchema.safeParse({ departmentId: null }).success).toBe(true);
  });

  it("still validates the fields that are present", () => {
    expect(updateDoctorSchema.safeParse({ name: "" }).success).toBe(false);
    expect(updateDoctorSchema.safeParse({ email: "bad" }).success).toBe(false);
  });
});

describe("listDoctorsQuerySchema and doctorIdParamSchema", () => {
  it("coerces numeric query strings", () => {
    const parsed = listDoctorsQuerySchema.parse({ page: "2", limit: "50", departmentId: "3" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.departmentId).toBe(3);
  });

  it("caps the page size at 100 and rejects invalid input", () => {
    expect(listDoctorsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(listDoctorsQuerySchema.safeParse({ status: "unknown" }).success).toBe(false);
    expect(listDoctorsQuerySchema.safeParse({ sortOrder: "sideways" }).success).toBe(false);
  });

  it("requires a positive integer doctor id", () => {
    expect(doctorIdParamSchema.parse({ id: "12" }).id).toBe(12);
    expect(doctorIdParamSchema.safeParse({ id: "0" }).success).toBe(false);
    expect(doctorIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
  });
});
