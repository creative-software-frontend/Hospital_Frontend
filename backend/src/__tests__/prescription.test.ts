import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const prisma = {
    patient: { findFirst: vi.fn() },
    doctor: { findFirst: vi.fn() },
    medicalRecord: { findFirst: vi.fn() },
    medicine: { findMany: vi.fn() },
    prescription: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    prescriptionItem: { findMany: vi.fn() },
    codeSequence: { upsert: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prisma };
});

vi.mock("../utils/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
}));

vi.mock("../middleware/permission.middleware", () => ({
  requirePermission: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

const mockPrisma = (await import("../lib/prisma")).prisma as unknown as {
  patient: { findFirst: ReturnType<typeof vi.fn> };
  doctor: { findFirst: ReturnType<typeof vi.fn> };
  medicalRecord: { findFirst: ReturnType<typeof vi.fn> };
  medicine: { findMany: ReturnType<typeof vi.fn> };
  prescription: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  prescriptionItem: { findMany: ReturnType<typeof vi.fn> };
  codeSequence: { upsert: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const { writeAuditLog } = await import("../utils/audit");
const mockWriteAuditLog = vi.mocked(writeAuditLog);
const { requirePermission } = await import("../middleware/permission.middleware");
const mockRequirePermission = vi.mocked(requirePermission);

import type { AuthUser } from "../types/auth";
import { ConflictError } from "../errors/ApiError";
import * as prescriptionService from "../modules/prescriptions/prescription.service";
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
} from "../modules/prescriptions/prescription.validation";
import prescriptionRoutes from "../modules/prescriptions/prescription.routes";

/** Captured at route-module load time, before beforeEach clears mock calls. */
const routePermissionCalls = mockRequirePermission.mock.calls.map((call) => [...call]);
const routeSignatures = (prescriptionRoutes as unknown as {
  stack: Array<{
    route?: {
      path: string;
      methods: Record<string, boolean>;
    };
  }>;
}).stack
  .filter((layer) => layer.route)
  .map((layer) => {
    const route = layer.route!;
    return `${Object.keys(route.methods)[0].toUpperCase()} ${route.path}`;
  });

const actor: AuthUser = {
  id: 9,
  email: "doctor@hospital.com",
  name: "Dr. Audit",
  branchId: 1,
  status: "ACTIVE",
  roles: [{ id: 2, seederKey: "DOCTOR", name: "Doctor" }],
};

const superAdmin: AuthUser = {
  ...actor,
  id: 1,
  email: "admin@hospital.com",
  name: "Super Admin",
  roles: [{ id: 1, seederKey: "SUPER_ADMIN", name: "Super Admin" }],
};

const VALID_INPUT = {
  patientId: 11,
  doctorId: 7,
  medicalRecordId: 51,
  notes: "Review after 5 days",
  items: [
    {
      medicineId: 1,
      dosage: "1 tablet",
      frequency: "1+0+1",
      duration: "5 days",
      instruction: "after food",
      quantity: 10,
      route: "oral",
    },
  ],
};

type SelectShape = Record<string, unknown> & {
  patient: { select: Record<string, unknown> };
  doctor: { select: Record<string, unknown> };
  items: {
    select: Record<string, unknown> & {
      medicine: { select: Record<string, unknown> };
    };
  };
};

type AuditCall = {
  oldValues?: {
    scalars?: Record<string, unknown>;
    items?: unknown[];
    status?: unknown;
  };
  newValues?: {
    scalars?: Record<string, unknown>;
    items?: unknown[];
    status?: unknown;
  };
};

function makePrescriptionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    branchId: 1,
    patientId: 11,
    doctorId: 7,
    medicalRecordId: 51,
    prescriptionNumber: "RX-000001",
    status: "ACTIVE",
    notes: "Review after 5 days",
    createdById: 9,
    createdAt: new Date("2026-11-25T09:00:00Z"),
    updatedAt: new Date("2026-11-25T09:00:00Z"),
    patient: {
      id: 11,
      patientCode: "PAT-000011",
      name: "Test Patient",
      gender: "MALE",
      dateOfBirth: null,
      phone: null,
    },
    doctor: {
      id: 7,
      doctorCode: "DOC-000007",
      name: "Dr. Audit",
      specialization: "General",
      signature: null,
    },
    medicalRecord: {
      id: 51,
      visitNumber: "VIS-000051",
      visitType: "OPD",
      chiefComplaint: "Fever",
      examination: null,
      vitals: null,
      createdAt: new Date("2026-11-25T08:00:00Z"),
    },
    items: [
      {
        id: 101,
        medicineId: 1,
        dosage: "1 tablet",
        frequency: "1+0+1",
        duration: "5 days",
        instruction: "after food",
        quantity: 10,
        route: "oral",
        medicine: {
          id: 1,
          medicineCode: "MED-000001",
          genericName: "Paracetamol",
          brandName: "Calpol",
          barcode: null,
        },
      },
    ],
    ...overrides,
  };
}

function setupReferences(patientBranchId = 1) {
  mockPrisma.patient.findFirst.mockResolvedValue({ id: 11, branchId: patientBranchId });
  mockPrisma.doctor.findFirst.mockResolvedValue({ id: 7, branchId: patientBranchId });
  mockPrisma.medicalRecord.findFirst.mockResolvedValue({
    id: 51,
    branchId: patientBranchId,
    patientId: 11,
  });
  mockPrisma.medicine.findMany.mockImplementation(async (args: { where: { id: { in: number[] } } }) =>
    args.where.id.in.map((id) => ({ id })),
  );
  mockPrisma.codeSequence.upsert.mockResolvedValue({ nextNumber: 1 });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) =>
    callback(mockPrisma),
  );
  // A successful conditional claim is the default; stale-status tests override it.
  mockPrisma.prescription.updateMany.mockResolvedValue({ count: 1 });
  setupReferences();
});

describe("Prescription validation", () => {
  it("rejects missing required fields", () => {
    const result = createPrescriptionSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("patientId");
      expect(paths).toContain("doctorId");
      expect(paths).toContain("items");
    }
  });

  it("requires medicineId for a new item and at least one field for an update", () => {
    const createResult = createPrescriptionSchema.safeParse({
      ...VALID_INPUT,
      items: [{ dosage: "1 tablet" }],
    });
    expect(createResult.success).toBe(false);

    const updateResult = updatePrescriptionSchema.safeParse({});
    expect(updateResult.success).toBe(false);

    const newItemResult = updatePrescriptionSchema.safeParse({ items: [{ dosage: "1 tablet" }] });
    expect(newItemResult.success).toBe(false);
  });

  it("rejects a no-op item update but accepts a real item change", () => {
    const noOp = updatePrescriptionSchema.safeParse({ items: [{ id: 123 }] });
    expect(noOp.success).toBe(false);
    if (!noOp.success) {
      expect(noOp.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Provide at least one change for an existing item",
            path: ["items", 0],
          }),
        ]),
      );
    }

    const changed = updatePrescriptionSchema.safeParse({
      items: [{ id: 123, frequency: "Twice daily" }],
    });
    expect(changed.success).toBe(true);
  });
});

describe("Prescription creation", () => {
  it("creates a prescription with an RX number and nested medicine items", async () => {
    mockPrisma.codeSequence.upsert.mockResolvedValue({ nextNumber: 7 });
    mockPrisma.prescription.create.mockImplementation(async (args: { data: { prescriptionNumber: string } }) =>
      makePrescriptionRow({ prescriptionNumber: args.data.prescriptionNumber }),
    );

    const result = await prescriptionService.createPrescription(actor, VALID_INPUT);

    expect(result.prescriptionNumber).toBe("RX-000007");
    expect(mockPrisma.codeSequence.upsert).toHaveBeenCalledWith({
      where: { entity_branchId: { entity: "Prescription", branchId: 1 } },
      update: { nextNumber: { increment: 1 } },
      create: { entity: "Prescription", branchId: 1, nextNumber: 1 },
      select: { nextNumber: true },
    });
    expect(mockPrisma.prescription.create).toHaveBeenCalledTimes(1);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "prescription",
        action: "create",
        tableName: "Prescription",
        branchId: 1,
      }),
    );
  });

  it("persists every prescription item field through the nested create", async () => {
    mockPrisma.prescription.create.mockImplementation(async () => makePrescriptionRow());

    await prescriptionService.createPrescription(actor, VALID_INPUT);

    const args = mockPrisma.prescription.create.mock.calls[0][0] as {
      data: { items: { create: unknown[] }; status: string; createdById: number };
    };
    expect(args.data.status).toBe("ACTIVE");
    expect(args.data.createdById).toBe(actor.id);
    expect(args.data.items.create).toEqual([
      {
        medicineId: 1,
        dosage: "1 tablet",
        frequency: "1+0+1",
        duration: "5 days",
        instruction: "after food",
        quantity: 10,
        route: "oral",
      },
    ]);
  });

  it("rejects an invalid patient", async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);
    await expect(prescriptionService.createPrescription(actor, VALID_INPUT)).rejects.toThrow(
      "Patient not found",
    );
    expect(mockPrisma.prescription.create).not.toHaveBeenCalled();
  });

  it("rejects an inactive doctor while preserving branch and soft-delete checks", async () => {
    mockPrisma.doctor.findFirst.mockResolvedValue(null);

    await expect(prescriptionService.createPrescription(actor, VALID_INPUT)).rejects.toThrow(
      "Doctor not found in this branch",
    );
    expect(mockPrisma.doctor.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7, branchId: 1, status: "active", deletedAt: null },
      }),
    );
    expect(mockPrisma.prescription.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid medicine in the actor's branch", async () => {
    mockPrisma.medicine.findMany.mockResolvedValue([]);
    await expect(prescriptionService.createPrescription(actor, VALID_INPUT)).rejects.toThrow(
      "One or more medicines were not found in this branch",
    );
    expect(mockPrisma.prescription.create).not.toHaveBeenCalled();
  });

  it("rejects an inactive medicine while preserving branch and soft-delete checks", async () => {
    mockPrisma.medicine.findMany.mockResolvedValue([]);

    await expect(prescriptionService.createPrescription(actor, VALID_INPUT)).rejects.toThrow(
      "One or more medicines were not found in this branch",
    );
    expect(mockPrisma.medicine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [1] }, branchId: 1, status: "active", deletedAt: null },
      }),
    );
    expect(mockPrisma.prescription.create).not.toHaveBeenCalled();
  });

  it("rejects a patient from another branch for a normal actor", async () => {
    setupReferences(2);
    await expect(prescriptionService.createPrescription(actor, VALID_INPUT)).rejects.toThrow(
      "Patient must belong to your branch",
    );
  });

  it("lets a super-admin prescribe for a patient in another branch", async () => {
    setupReferences(2);
    mockPrisma.prescription.create.mockImplementation(async () =>
      makePrescriptionRow({ branchId: 2 }),
    );

    const result = await prescriptionService.createPrescription(superAdmin, VALID_INPUT);

    expect(result.branchId).toBe(2);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 2 }),
    );
  });

  it("rolls back the transaction when the RX sequence cannot be claimed", async () => {
    const failure = new Error("sequence failure");
    mockPrisma.codeSequence.upsert.mockRejectedValue(failure);

    await expect(prescriptionService.createPrescription(actor, VALID_INPUT)).rejects.toThrow(
      "sequence failure",
    );
    expect(mockPrisma.prescription.create).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});

describe("Prescription retrieval", () => {
  it("lists prescriptions with branch-scoped pagination and search", async () => {
    const row = makePrescriptionRow();
    mockPrisma.prescription.count.mockResolvedValue(21);
    mockPrisma.prescription.findMany.mockResolvedValue([row]);

    const result = await prescriptionService.listPrescriptions(actor, {
      page: 2,
      limit: 10,
      patientId: 11,
      status: "ACTIVE",
      search: "Paracetamol",
    });

    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
    expect(mockPrisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 1,
          patientId: 11,
          status: "ACTIVE",
          OR: expect.arrayContaining([
            { items: { some: { medicine: { genericName: { contains: "Paracetamol" } } } } },
          ]),
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it("uses a minimized list projection without sensitive clinical fields", async () => {
    mockPrisma.prescription.count.mockResolvedValue(1);
    mockPrisma.prescription.findMany.mockResolvedValue([makePrescriptionRow()]);

    await prescriptionService.listPrescriptions(actor, {});

    const call = mockPrisma.prescription.findMany.mock.calls[0][0] as { select: SelectShape };
    expect(Object.keys(call.select).sort()).toEqual(
      [
        "id",
        "prescriptionNumber",
        "status",
        "createdAt",
        "updatedAt",
        "patient",
        "doctor",
        "items",
      ].sort(),
    );
    expect(call.select.patient.select).toEqual({ id: true, patientCode: true, name: true });
    expect(call.select.doctor.select).toEqual({ id: true, name: true });
    expect(Object.keys(call.select.items.select).sort()).toEqual(
      ["id", "medicineId", "medicine"].sort(),
    );
    expect(call.select.items.select.medicine.select).toEqual({
      id: true,
      medicineCode: true,
      genericName: true,
      brandName: true,
    });

    // These belong to the detail projection only.
    expect(call.select.notes).toBeUndefined();
    expect(call.select.medicalRecord).toBeUndefined();
    expect(call.select.createdById).toBeUndefined();
    expect(call.select.patient.select.dateOfBirth).toBeUndefined();
    expect(call.select.patient.select.phone).toBeUndefined();
    expect(call.select.doctor.select.signature).toBeUndefined();
    expect(call.select.items.select.medicine.select.barcode).toBeUndefined();
  });

  it("returns the patient, doctor and medicine relations for one prescription", async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(makePrescriptionRow());

    const result = await prescriptionService.getPrescription(actor, 1);

    expect(result.patient.patientCode).toBe("PAT-000011");
    expect(result.doctor.doctorCode).toBe("DOC-000007");
    expect(result.items[0].medicine.genericName).toBe("Paracetamol");
  });

  it("keeps the full clinical projection for the detail endpoint", async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(makePrescriptionRow());

    await prescriptionService.getPrescription(actor, 1);

    const call = mockPrisma.prescription.findFirst.mock.calls[0][0] as { select: SelectShape };
    expect(call.select.medicalRecord).toBeDefined();
    expect(call.select.patient.select.dateOfBirth).toBe(true);
    expect(call.select.patient.select.phone).toBe(true);
    expect(call.select.doctor.select.signature).toBe(true);
    expect(call.select.items.select.medicine.select.barcode).toBe(true);
  });

  it("denies unauthorized cross-branch access to a prescription", async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(makePrescriptionRow({ branchId: 2 }));

    await expect(prescriptionService.getPrescription(actor, 1)).rejects.toThrow(
      "Prescription must belong to your branch",
    );
  });
});

describe("Prescription updates", () => {
  it("conditionally claims an ACTIVE row and writes scalar fields and items atomically", async () => {
    mockPrisma.prescription.findFirst
      .mockResolvedValueOnce(makePrescriptionRow())
      .mockResolvedValueOnce(makePrescriptionRow({ notes: "Changed" }));
    mockPrisma.prescriptionItem.findMany.mockResolvedValue([{ id: 101 }]);
    mockPrisma.prescription.update.mockResolvedValue({});

    const result = await prescriptionService.updatePrescription(actor, 1, {
      notes: "Changed",
      items: [
        { id: 101, dosage: "2 tablets" },
        {
          medicineId: 2,
          frequency: "1+1+1",
          duration: "3 days",
          instruction: "after meals",
          quantity: 9,
          route: "oral",
        },
      ],
    });

    expect(result.notes).toBe("Changed");
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.prescription.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: "ACTIVE" },
      data: expect.objectContaining({ notes: "Changed", updatedAt: expect.any(Date) }),
    });

    const itemWriteArgs = mockPrisma.prescription.update.mock.calls[0][0] as {
      data: { items: { update: unknown[]; create: unknown[] } };
    };
    expect(itemWriteArgs.data.items.update).toEqual([
      { where: { id: 101 }, data: { dosage: "2 tablets" } },
    ]);
    expect(itemWriteArgs.data.items.create).toEqual([
      {
        medicineId: 2,
        dosage: null,
        frequency: "1+1+1",
        duration: "3 days",
        instruction: "after meals",
        quantity: 9,
        route: "oral",
      },
    ]);
    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ module: "prescription", action: "update" }),
    );
  });

  it("rejects a stale ACTIVE read when the conditional claim affects zero rows", async () => {
    mockPrisma.prescription.findFirst.mockResolvedValueOnce(makePrescriptionRow());
    mockPrisma.prescription.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      prescriptionService.updatePrescription(actor, 1, { notes: "late edit" }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(mockPrisma.prescription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, status: "ACTIVE" } }),
    );
    expect(mockPrisma.prescription.update).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("rejects an inactive doctor on update", async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(makePrescriptionRow());
    mockPrisma.doctor.findFirst.mockResolvedValue(null);

    await expect(
      prescriptionService.updatePrescription(actor, 1, { doctorId: 8 }),
    ).rejects.toThrow("Doctor not found in this branch");
    expect(mockPrisma.doctor.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 8, branchId: 1, status: "active", deletedAt: null },
      }),
    );
    expect(mockPrisma.prescription.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an inactive medicine on update", async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(makePrescriptionRow());
    mockPrisma.prescriptionItem.findMany.mockResolvedValue([{ id: 101 }]);
    mockPrisma.medicine.findMany.mockResolvedValue([]);

    await expect(
      prescriptionService.updatePrescription(actor, 1, {
        items: [{ id: 101, medicineId: 2, frequency: "Twice daily" }],
      }),
    ).rejects.toThrow("One or more medicines were not found in this branch");
    expect(mockPrisma.medicine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [2] }, branchId: 1, status: "active", deletedAt: null },
      }),
    );
    expect(mockPrisma.prescription.updateMany).not.toHaveBeenCalled();
  });

  it("records meaningful old and new audit values without clinical note text", async () => {
    mockPrisma.prescription.findFirst
      .mockResolvedValueOnce(makePrescriptionRow())
      .mockResolvedValueOnce(makePrescriptionRow({ doctorId: 8, medicalRecordId: 52 }));
    mockPrisma.prescriptionItem.findMany.mockResolvedValue([{ id: 101 }]);
    mockPrisma.prescription.update.mockResolvedValue({});

    await prescriptionService.updatePrescription(actor, 1, {
      doctorId: 8,
      medicalRecordId: 52,
      notes: "Sensitive clinical note",
      items: [{ id: 101, quantity: 12, route: "IV" }],
    });

    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
    const audit = mockWriteAuditLog.mock.calls[0][0] as AuditCall;
    expect(audit.oldValues?.scalars).toEqual({
      status: "ACTIVE",
      doctorId: 7,
      medicalRecordId: 51,
      notes: "[changed]",
    });
    expect(audit.newValues?.scalars).toEqual({
      doctorId: 8,
      medicalRecordId: 52,
      notes: "[changed]",
    });
    expect(audit.oldValues?.items).toEqual([
      { itemId: 101, quantity: 10, route: "oral" },
    ]);
    expect(audit.newValues?.items).toEqual([{ itemId: 101, quantity: 12, route: "IV" }]);
    expect(JSON.stringify(audit)).not.toContain("Sensitive clinical note");
  });

  it("rejects an item that belongs to another prescription", async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(makePrescriptionRow());
    mockPrisma.prescriptionItem.findMany.mockResolvedValue([]);

    await expect(
      prescriptionService.updatePrescription(actor, 1, { items: [{ id: 999, dosage: "x" }] }),
    ).rejects.toThrow("Prescription item not found on this prescription");
    expect(mockPrisma.prescription.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to update a dispensed prescription", async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(makePrescriptionRow({ status: "DISPENSED" }));

    await expect(prescriptionService.updatePrescription(actor, 1, { notes: "late edit" })).rejects.toThrow(
      "Only an ACTIVE prescription can be updated",
    );
    expect(mockPrisma.prescription.updateMany).not.toHaveBeenCalled();
  });
});

describe("Prescription cancellation", () => {
  it("conditionally cancels an ACTIVE prescription without deleting it", async () => {
    mockPrisma.prescription.findFirst
      .mockResolvedValueOnce(makePrescriptionRow())
      .mockResolvedValueOnce(makePrescriptionRow({ status: "CANCELLED" }));

    const result = await prescriptionService.cancelPrescription(actor, 1);

    expect(result.status).toBe("CANCELLED");
    expect(mockPrisma.prescription.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: { in: ["ACTIVE", "PARTIALLY_DISPENSED"] } },
      data: { status: "CANCELLED" },
    });
    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cancel",
        oldValues: { status: "ACTIVE" },
        newValues: { status: "CANCELLED" },
      }),
    );
  });

  it("cancels a PARTIALLY_DISPENSED prescription", async () => {
    mockPrisma.prescription.findFirst
      .mockResolvedValueOnce(makePrescriptionRow({ status: "PARTIALLY_DISPENSED" }))
      .mockResolvedValueOnce(makePrescriptionRow({ status: "CANCELLED" }));

    const result = await prescriptionService.cancelPrescription(actor, 1);

    expect(result.status).toBe("CANCELLED");
    expect(mockPrisma.prescription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, status: { in: ["ACTIVE", "PARTIALLY_DISPENSED"] } },
      }),
    );
  });

  it("does not write a second audit event when the conditional cancel claim is stale", async () => {
    mockPrisma.prescription.findFirst.mockResolvedValueOnce(makePrescriptionRow());
    mockPrisma.prescription.updateMany.mockResolvedValue({ count: 0 });

    await expect(prescriptionService.cancelPrescription(actor, 1)).rejects.toBeInstanceOf(
      ConflictError,
    );

    expect(mockPrisma.prescription.update).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("refuses to cancel a dispensed prescription", async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(makePrescriptionRow({ status: "DISPENSED" }));

    await expect(prescriptionService.cancelPrescription(actor, 1)).rejects.toThrow(
      "This prescription cannot be cancelled",
    );
    expect(mockPrisma.prescription.updateMany).not.toHaveBeenCalled();
  });
});

describe("Prescription route contract", () => {
  it("requires seeded prescription permissions and exposes no hard-delete route", () => {
    expect(routePermissionCalls).toEqual(
      expect.arrayContaining([
        ["prescription", "read"],
        ["prescription", "create"],
        ["prescription", "update"],
      ]),
    );
    expect(mockRequirePermission).not.toHaveBeenCalledWith("prescription", "delete");
    expect(routeSignatures).toContain("PATCH /:id/cancel");
    expect(routeSignatures).not.toContain("DELETE /:id");
  });
});
