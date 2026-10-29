import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma", () => {
  const makeModel = () => ({
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  });

  const tx = {
    codeSequence: { upsert: vi.fn(), findUnique: vi.fn() },
    emergencyCase: { create: vi.fn() },
  };

  const prismaClient = {
    patient: makeModel(),
    emergencyCase: makeModel(),
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    __tx: tx,
  };

  return { prisma: prismaClient, default: prismaClient };
});

vi.mock("../utils/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../modules/patients/patient.service", () => ({
  createPatient: vi.fn(),
}));

import { prisma } from "../lib/prisma";
import * as patientService from "../modules/patients/patient.service";
import * as emergencyService from "../modules/emergency/emergency.service";
import {
  createEmergencyCaseSchema,
  listEmergencyCasesQuerySchema,
} from "../modules/emergency/emergency.validation";
import type { AuthUser } from "../types/auth";

const mockPrisma = prisma as unknown as {
  patient: { update: ReturnType<typeof vi.fn> };
  emergencyCase: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  __tx: {
    codeSequence: { upsert: ReturnType<typeof vi.fn> };
    emergencyCase: { create: ReturnType<typeof vi.fn> };
  };
};

const actor: AuthUser = {
  id: 1,
  branchId: 1,
  name: "Super Admin",
  email: "admin@hospital.com",
  roles: [{ id: 1, seederKey: "SUPER_ADMIN", name: "Super Admin" }],
};

const PATIENT_ROW = {
  id: 10,
  patientCode: "PAT-000010",
  name: "Unknown Male ~40",
  gender: null,
  dateOfBirth: null,
  phone: null,
  address: null,
};

const CASE_ROW = {
  id: 5,
  caseNumber: "EMR-000005",
  priority: "CRITICAL",
  chiefComplaint: "Chest pain",
  unidentified: true,
  arrivedAt: new Date("2026-10-27T09:00:00.000Z"),
  createdAt: new Date("2026-10-27T09:00:00.000Z"),
  patient: PATIENT_ROW,
};

describe("emergency validation", () => {
  it("only requires a name", () => {
    const parsed = createEmergencyCaseSchema.parse({ patient: { name: "Rahim" } });
    expect(parsed.patient.name).toBe("Rahim");
    expect(parsed.priority).toBe("URGENT");
  });

  it("rejects a blank name", () => {
    const result = createEmergencyCaseSchema.safeParse({ patient: { name: "   " } });
    expect(result.success).toBe(false);
  });

  it("treats an untouched complaint as absent", () => {
    const parsed = createEmergencyCaseSchema.parse({
      patient: { name: "Rahim" },
      chiefComplaint: "",
    });
    expect(parsed.chiefComplaint).toBeUndefined();
  });

  it("ignores the demographic fields that are completed later", () => {
    const parsed = createEmergencyCaseSchema.parse({
      patient: {
        name: "Rahim",
        phone: "01712345678",
        dateOfBirth: "1990-05-12",
        emergencyContactName: "Karim",
      },
      doctorId: 4,
      arrivalMode: "AMBULANCE",
      triageNotes: "Unresponsive",
      branchId: 2,
    });
    // Only the four intake fields reach the service.
    expect(Object.keys(parsed.patient).sort()).toEqual(["name"]);
    expect(parsed).not.toHaveProperty("doctorId");
    expect(parsed).not.toHaveProperty("arrivalMode");
    expect(parsed).not.toHaveProperty("triageNotes");
    expect(parsed).not.toHaveProperty("branchId");
  });

  it("rejects an impossible age and an unknown priority", () => {
    expect(
      createEmergencyCaseSchema.safeParse({ patient: { name: "A", approxAge: 200 } }).success,
    ).toBe(false);
    expect(
      createEmergencyCaseSchema.safeParse({ patient: { name: "A" }, priority: "SOON" }).success,
    ).toBe(false);
  });

  it("coerces the list flags and drops the removed filters", () => {
    const parsed = listEmergencyCasesQuerySchema.parse({
      date: "2026-10-27",
      incomplete: "true",
      page: "2",
      limit: "10",
      priority: "CRITICAL",
      search: "chest",
    });
    expect(parsed.incomplete).toBe(true);
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
    expect(parsed).not.toHaveProperty("priority");
    expect(parsed).not.toHaveProperty("search");
  });
});

describe("emergency service - registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (patientService.createPatient as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      branchId: 1,
      patientCode: "PAT-000010",
      patientType: "NEW",
      duplicateWarnings: [],
    });
    (mockPrisma.__tx.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      nextNumber: 5,
    });
    (mockPrisma.__tx.emergencyCase.create as ReturnType<typeof vi.fn>).mockResolvedValue(CASE_ROW);
    (mockPrisma.patient.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it("creates the patient with the minimum intake data, then the case", async () => {
    const result = await emergencyService.registerEmergencyCase(actor, {
      patient: { name: "Unknown Male ~40", approxAge: 40, gender: "MALE" },
      priority: "CRITICAL",
      chiefComplaint: "Chest pain",
      unidentified: true,
    });

    const createArgs = (patientService.createPatient as ReturnType<typeof vi.fn>).mock.calls[0];
    const patientInput = createArgs[1];
    expect(patientInput.name).toBe("Unknown Male ~40");
    expect(patientInput.gender).toBe("MALE");
    expect(patientInput.dateOfBirth.getFullYear()).toBe(new Date().getFullYear() - 40);
    // Only the identity is sent: no phone, contact or branch override.
    expect(Object.keys(patientInput).sort()).toEqual(["dateOfBirth", "gender", "name"]);
    // Emergency intake relaxes the branch's required-demographic/guardian rules.
    expect(createArgs[2]).toEqual({ forEmergency: true });

    const caseData = (mockPrisma.__tx.emergencyCase.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0].data;
    expect(caseData).toMatchObject({
      branchId: 1,
      patientId: 10,
      caseNumber: "EMR-000005",
      priority: "CRITICAL",
      unidentified: true,
      registeredById: 1,
    });
    expect(Object.keys(caseData).sort()).toEqual([
      "branchId",
      "caseNumber",
      "chiefComplaint",
      "patientId",
      "priority",
      "registeredById",
      "unidentified",
    ]);

    expect(result.emergencyCase.caseNumber).toBe("EMR-000005");
    expect(result.emergencyCase.patient.missing).toEqual([
      "Gender",
      "Date of birth",
      "Phone",
      "Address",
    ]);
  });

  it("always registers into the caller's own branch", async () => {
    const receptionist: AuthUser = {
      ...actor,
      branchId: 2,
      roles: [{ id: 6, seederKey: "RECEPTIONIST", name: "Receptionist" }],
    };

    await emergencyService.registerEmergencyCase(receptionist, {
      patient: { name: "Rahim" },
      priority: "URGENT",
    });

    const patientInput = (patientService.createPatient as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(patientInput.branchId).toBeUndefined();

    const caseData = (mockPrisma.__tx.emergencyCase.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0].data;
    expect(caseData.branchId).toBe(2);
  });

  it("retires the patient when the case cannot be written", async () => {
    (mockPrisma.__tx.emergencyCase.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom"),
    );

    await expect(
      emergencyService.registerEmergencyCase(actor, {
        patient: { name: "Rahim" },
        priority: "URGENT",
      }),
    ).rejects.toThrow("boom");

    expect(mockPrisma.patient.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe("emergency service - queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockPrisma.emergencyCase.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    (mockPrisma.emergencyCase.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([CASE_ROW]);
  });

  it("lists one day with the filter, the missing-field list and the day summary", async () => {
    const result = await emergencyService.listEmergencyCases(actor, {
      date: "2026-10-27",
      incomplete: true,
      page: 1,
      limit: 10,
    });

    const where = (mockPrisma.emergencyCase.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .where;
    expect(where).toMatchObject({
      branchId: 1,
      deletedAt: null,
      patient: { OR: expect.any(Array) },
    });
    expect(where).not.toHaveProperty("priority");
    expect(where).not.toHaveProperty("OR");
    expect(where.arrivedAt.gte).toEqual(new Date("2026-10-27T00:00:00"));
    expect(where.arrivedAt.lt).toEqual(new Date("2026-10-28T00:00:00"));

    expect(result.data[0].patient.missing).toHaveLength(4);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(result.summary).toEqual({
      date: "2026-10-27",
      total: 3,
      needsInfo: 2,
    });
  });

  it("defaults to today and drops the optional filters", async () => {
    const result = await emergencyService.listEmergencyCases(actor, {});

    const where = (mockPrisma.emergencyCase.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .where;
    expect(where.patient).toBeUndefined();

    const today = new Date();
    expect(result.summary.date).toBe(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
        today.getDate(),
      ).padStart(2, "0")}`,
    );
  });
});
