import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import { CODE_ENTITIES, generateBusinessCode } from "../../utils/codeGenerator";
import type { AuthUser } from "../../types/auth";
import type {
  CreatePrescriptionInput,
  CreatePrescriptionItemInput,
  ListPrescriptionsQuery,
  UpdatePrescriptionInput,
  UpdatePrescriptionItemInput,
} from "./prescription.validation";

/** Full projection for get/create/update/cancel responses and print workflow. */
const PRESCRIPTION_DETAIL_SELECT: Prisma.PrescriptionSelect = {
  id: true,
  branchId: true,
  patientId: true,
  doctorId: true,
  medicalRecordId: true,
  prescriptionNumber: true,
  status: true,
  notes: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: {
      id: true,
      patientCode: true,
      name: true,
      gender: true,
      dateOfBirth: true,
      phone: true,
    },
  },
  doctor: {
    select: {
      id: true,
      doctorCode: true,
      name: true,
      specialization: true,
      signature: true,
    },
  },
  medicalRecord: {
    select: {
      id: true,
      visitNumber: true,
      visitType: true,
      chiefComplaint: true,
      examination: true,
      vitals: true,
      createdAt: true,
    },
  },
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      medicineId: true,
      dosage: true,
      frequency: true,
      duration: true,
      instruction: true,
      quantity: true,
      route: true,
      medicine: {
        select: {
          id: true,
          medicineCode: true,
          genericName: true,
          brandName: true,
          barcode: true,
        },
      },
    },
  },
};

/**
 * Compact projection for paginated list rows. Clinical detail, patient contact
 * data, doctor signature, and medicine barcode stay in the detail endpoint.
 */
const PRESCRIPTION_LIST_SELECT: Prisma.PrescriptionSelect = {
  id: true,
  prescriptionNumber: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: {
      id: true,
      patientCode: true,
      name: true,
    },
  },
  doctor: {
    select: {
      id: true,
      name: true,
    },
  },
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      medicineId: true,
      medicine: {
        select: {
          id: true,
          medicineCode: true,
          genericName: true,
          brandName: true,
        },
      },
    },
  },
};

type PrescriptionRow = Prisma.PrescriptionGetPayload<{ select: typeof PRESCRIPTION_DETAIL_SELECT }>;

/** Both the base Prisma client and a transaction delegate satisfy this shape. */
type LookupClient = Pick<
  Prisma.TransactionClient,
  "patient" | "doctor" | "medicalRecord" | "medicine" | "prescriptionItem"
>;

type AuditRecord = Record<string, string | number | boolean | null | string[]>;

const CANCELLABLE_STATUSES = ["ACTIVE", "PARTIALLY_DISPENSED"] as const;

/** Text values are deliberately replaced by a marker in audit metadata. */
const AUDITED_ITEM_FIELDS = ["medicineId", "quantity", "route"];

function toAuditValue(value: unknown): string | number | boolean | null {
  return value === undefined || value === null ? null : (value as string | number | boolean);
}

function isSuperAdmin(actor: AuthUser) {
  return actor.roles.some((role) => role.seederKey === "SUPER_ADMIN");
}

function ensureBranch(actor: AuthUser, targetBranchId: number, resource: string) {
  if (actor.branchId !== targetBranchId && !isSuperAdmin(actor)) {
    throw new AuthorizationError(`${resource} must belong to your branch`);
  }
}

function assertUniqueNumbers(values: number[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new BusinessRuleError(`Duplicate ${label} are not allowed`, {
      items: `Each ${label.slice(0, -1)} may appear only once`,
    });
  }
}

async function loadPatient(actor: AuthUser, patientId: number, db: LookupClient) {
  const patient = await db.patient.findFirst({
    where: { id: patientId, deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!patient) throw new NotFoundError("Patient not found");
  ensureBranch(actor, patient.branchId, "Patient");
  return patient;
}

async function loadDoctor(doctorId: number, branchId: number, db: LookupClient) {
  const doctor = await db.doctor.findFirst({
    where: { id: doctorId, branchId, status: "active", deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!doctor) throw new NotFoundError("Doctor not found in this branch");
  return doctor;
}

async function loadMedicalRecord(
  medicalRecordId: number,
  patientId: number,
  branchId: number,
  db: LookupClient,
) {
  const medicalRecord = await db.medicalRecord.findFirst({
    where: { id: medicalRecordId, branchId, patientId, deletedAt: null },
    select: { id: true, branchId: true, patientId: true },
  });
  if (!medicalRecord) {
    throw new NotFoundError("Medical record not found for this patient and branch");
  }
  return medicalRecord;
}

async function loadMedicines(medicineIds: number[], branchId: number, db: LookupClient) {
  const uniqueIds = [...new Set(medicineIds)];
  const medicines = await db.medicine.findMany({
    where: { id: { in: uniqueIds }, branchId, status: "active", deletedAt: null },
    select: { id: true },
  });
  if (medicines.length !== uniqueIds.length) {
    throw new NotFoundError("One or more medicines were not found in this branch");
  }
  return medicines;
}

function itemCreateData(item: CreatePrescriptionItemInput) {
  return {
    medicineId: item.medicineId,
    dosage: item.dosage ?? null,
    frequency: item.frequency ?? null,
    duration: item.duration ?? null,
    instruction: item.instruction ?? null,
    quantity: item.quantity ?? null,
    route: item.route ?? null,
  };
}

function itemUpdateData(item: UpdatePrescriptionItemInput) {
  const data: Prisma.PrescriptionItemUncheckedUpdateWithoutPrescriptionInput = {};
  if (item.medicineId !== undefined) data.medicineId = item.medicineId;
  if (item.dosage !== undefined) data.dosage = item.dosage ?? null;
  if (item.frequency !== undefined) data.frequency = item.frequency ?? null;
  if (item.duration !== undefined) data.duration = item.duration ?? null;
  if (item.instruction !== undefined) data.instruction = item.instruction ?? null;
  if (item.quantity !== undefined) data.quantity = item.quantity ?? null;
  if (item.route !== undefined) data.route = item.route ?? null;
  return data;
}

export async function listPrescriptions(actor: AuthUser, query: ListPrescriptionsQuery) {
  const { page, limit } = parsePagination(query as Record<string, unknown>);
  const where: Prisma.PrescriptionWhereInput = { branchId: actor.branchId };

  if (query.patientId) where.patientId = query.patientId;
  if (query.doctorId) where.doctorId = query.doctorId;
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { prescriptionNumber: { contains: query.search } },
      { notes: { contains: query.search } },
      { patient: { name: { contains: query.search } } },
      { patient: { patientCode: { contains: query.search } } },
      { doctor: { name: { contains: query.search } } },
      { items: { some: { medicine: { genericName: { contains: query.search } } } } },
      { items: { some: { medicine: { brandName: { contains: query.search } } } } },
      { items: { some: { medicine: { medicineCode: { contains: query.search } } } } },
    ];
  }

  const [total, data] = await Promise.all([
    prisma.prescription.count({ where }),
    prisma.prescription.findMany({
      where,
      select: PRESCRIPTION_LIST_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getPrescription(actor: AuthUser, id: number) {
  const row = await prisma.prescription.findFirst({
    where: { id },
    select: PRESCRIPTION_DETAIL_SELECT,
  });
  if (!row) throw new NotFoundError("Prescription not found");
  ensureBranch(actor, row.branchId, "Prescription");
  return row;
}

export async function createPrescription(actor: AuthUser, input: CreatePrescriptionInput) {
  const patient = await loadPatient(actor, input.patientId, prisma);
  const branchId = patient.branchId;
  await loadDoctor(input.doctorId, branchId, prisma);
  if (input.medicalRecordId) {
    await loadMedicalRecord(input.medicalRecordId, patient.id, branchId, prisma);
  }

  assertUniqueNumbers(
    input.items.map((item) => item.medicineId),
    "medicines",
  );
  await loadMedicines(
    input.items.map((item) => item.medicineId),
    branchId,
    prisma,
  );

  const created = await prisma.$transaction(async (tx) => {
    // The code-sequence upsert is inside the same transaction as the insert, so
    // concurrent creates get distinct RX numbers and a failed insert rolls the
    // claimed number back with it.
    const prescriptionNumber = await generateBusinessCode(
      tx,
      CODE_ENTITIES.PRESCRIPTION,
      branchId,
    );

    return tx.prescription.create({
      data: {
        branchId,
        patientId: patient.id,
        doctorId: input.doctorId,
        medicalRecordId: input.medicalRecordId ?? null,
        prescriptionNumber,
        status: "ACTIVE",
        notes: input.notes ?? null,
        createdById: actor.id,
        items: { create: input.items.map(itemCreateData) },
      },
      select: PRESCRIPTION_DETAIL_SELECT,
    });
  });

  await writeAuditLog({
    module: "prescription",
    action: "create",
    tableName: "Prescription",
    recordId: String(created.id),
    newValues: {
      prescriptionNumber: created.prescriptionNumber,
      patientId: created.patientId,
      doctorId: created.doctorId,
      medicalRecordId: created.medicalRecordId,
      itemCount: created.items.length,
    },
    user: actor,
    branchId,
  });

  return created;
}

export async function updatePrescription(
  actor: AuthUser,
  id: number,
  input: UpdatePrescriptionInput,
) {
  const existing = await prisma.prescription.findFirst({
    where: { id },
    select: {
      id: true,
      branchId: true,
      patientId: true,
      doctorId: true,
      medicalRecordId: true,
      notes: true,
      status: true,
      items: {
        select: {
          id: true,
          medicineId: true,
          dosage: true,
          frequency: true,
          duration: true,
          instruction: true,
          quantity: true,
          route: true,
        },
      },
    },
  });
  if (!existing) throw new NotFoundError("Prescription not found");
  ensureBranch(actor, existing.branchId, "Prescription");

  if (existing.status !== "ACTIVE") {
    throw new BusinessRuleError(`Only an ACTIVE prescription can be updated (status is ${existing.status})`);
  }

  if (input.doctorId !== undefined && input.doctorId !== null) {
    await loadDoctor(input.doctorId, existing.branchId, prisma);
  }
  if (input.medicalRecordId !== undefined && input.medicalRecordId !== null) {
    await loadMedicalRecord(input.medicalRecordId, existing.patientId, existing.branchId, prisma);
  }

  let itemUpdates: Array<{ where: { id: number }; data: Prisma.PrescriptionItemUncheckedUpdateWithoutPrescriptionInput }> | undefined;
  let itemCreates: ReturnType<typeof itemCreateData>[] | undefined;

  if (input.items) {
    const existingItemIds = input.items.flatMap((item) => (item.id ? [item.id] : []));
    const newItemIds = input.items.flatMap((item) =>
      item.medicineId ? [item.medicineId] : [],
    );
    assertUniqueNumbers(existingItemIds, "prescription item ids");
    assertUniqueNumbers(newItemIds, "medicines");

    if (existingItemIds.length > 0) {
      const ownedItems = await prisma.prescriptionItem.findMany({
        where: { id: { in: existingItemIds }, prescriptionId: id },
        select: { id: true },
      });
      if (ownedItems.length !== new Set(existingItemIds).size) {
        throw new NotFoundError("Prescription item not found on this prescription");
      }
    }

    const changedMedicineIds = input.items.flatMap((item) =>
      item.id && item.medicineId ? [item.medicineId] : [],
    );
    const medicinesToCheck = [...newItemIds, ...changedMedicineIds];
    if (medicinesToCheck.length > 0) {
      await loadMedicines(medicinesToCheck, existing.branchId, prisma);
    }

    itemUpdates = input.items
      .filter((item) => item.id !== undefined)
      .map((item) => ({ where: { id: item.id! }, data: itemUpdateData(item) }));
    itemCreates = input.items
      .filter((item) => item.id === undefined)
      .map((item) => itemCreateData(item as CreatePrescriptionItemInput));
  }

  const scalarData: Prisma.PrescriptionUncheckedUpdateManyInput = { updatedAt: new Date() };
  if (input.doctorId !== undefined) scalarData.doctorId = input.doctorId;
  if (input.medicalRecordId !== undefined) scalarData.medicalRecordId = input.medicalRecordId;
  if (input.notes !== undefined) scalarData.notes = input.notes ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    // Claim the row with a conditional update. The affected-row check closes
    // the window between the status read above and the actual mutation.
    const claimed = await tx.prescription.updateMany({
      where: { id, status: "ACTIVE" },
      data: scalarData,
    });
    if (claimed.count !== 1) {
      throw new ConflictError("Prescription status changed before it could be updated");
    }

    const itemWrite: { update?: typeof itemUpdates; create?: typeof itemCreates } = {};
    if (itemUpdates?.length) itemWrite.update = itemUpdates;
    if (itemCreates?.length) itemWrite.create = itemCreates;
    if (itemWrite.update || itemWrite.create) {
      await tx.prescription.update({
        where: { id },
        data: { items: itemWrite } as Prisma.PrescriptionUncheckedUpdateInput,
      });
    }

    const row = await tx.prescription.findFirst({
      where: { id, branchId: existing.branchId },
      select: PRESCRIPTION_DETAIL_SELECT,
    });
    if (!row) throw new NotFoundError("Prescription not found");
    return row;
  });

  const oldScalar: AuditRecord = { status: existing.status };
  const newScalar: AuditRecord = {};
  if (input.doctorId !== undefined && input.doctorId !== existing.doctorId) {
    oldScalar.doctorId = toAuditValue(existing.doctorId);
    newScalar.doctorId = toAuditValue(input.doctorId);
  }
  if (input.medicalRecordId !== undefined && input.medicalRecordId !== existing.medicalRecordId) {
    oldScalar.medicalRecordId = toAuditValue(existing.medicalRecordId);
    newScalar.medicalRecordId = toAuditValue(input.medicalRecordId);
  }
  if (input.notes !== undefined && input.notes !== existing.notes) {
    // Clinical note text stays out of audit metadata; only the fact of a change
    // is recorded.
    oldScalar.notes = "[changed]";
    newScalar.notes = "[changed]";
  }

  const oldItemsById = new Map(existing.items.map((item) => [item.id, item]));
  const oldItemAudit: AuditRecord[] = [];
  const newItemAudit: AuditRecord[] = [];

  for (const { where, data } of itemUpdates ?? []) {
    const before = oldItemsById.get(where.id);
    const dataRecord = data as unknown as Record<string, unknown>;
    const changedFields = Object.keys(dataRecord).filter(
      (field) => dataRecord[field] !== undefined,
    );
    const from: AuditRecord = { itemId: where.id };
    const to: AuditRecord = { itemId: where.id };

    for (const field of AUDITED_ITEM_FIELDS) {
      if (field in dataRecord) {
        from[field] = toAuditValue(before?.[field as keyof typeof before]);
        to[field] = toAuditValue(dataRecord[field]);
      }
    }
    const redactedFields = changedFields.filter((field) => !AUDITED_ITEM_FIELDS.includes(field));
    if (redactedFields.length > 0) {
      from.changedFields = redactedFields;
      to.changedFields = redactedFields;
    }
    oldItemAudit.push(from);
    newItemAudit.push(to);
  }

  for (const item of itemCreates ?? []) {
    oldItemAudit.push({ medicineId: null });
    newItemAudit.push({ medicineId: item.medicineId, quantity: toAuditValue(item.quantity) });
  }

  await writeAuditLog({
    module: "prescription",
    action: "update",
    tableName: "Prescription",
    recordId: String(id),
    oldValues: { scalars: oldScalar, items: oldItemAudit } as Prisma.InputJsonValue,
    newValues: { scalars: newScalar, items: newItemAudit } as Prisma.InputJsonValue,
    user: actor,
    branchId: existing.branchId,
  });

  return updated;
}

/**
 * Clinical-safe cancellation: no DELETE, no new cancellation columns. A
 * partially dispensed order may be stopped, but a fully dispensed one is
 * immutable. Re-cancelling is a no-op conflict rather than a second audit event.
 */
export async function cancelPrescription(actor: AuthUser, id: number) {
  const existing = await prisma.prescription.findFirst({
    where: { id },
    select: {
      id: true,
      branchId: true,
      status: true,
      prescriptionNumber: true,
    },
  });
  if (!existing) throw new NotFoundError("Prescription not found");
  ensureBranch(actor, existing.branchId, "Prescription");

  if (!CANCELLABLE_STATUSES.includes(existing.status as (typeof CANCELLABLE_STATUSES)[number])) {
    throw new BusinessRuleError(`This prescription cannot be cancelled (status is ${existing.status})`);
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const claimed = await tx.prescription.updateMany({
      where: { id, status: { in: [...CANCELLABLE_STATUSES] } },
      data: { status: "CANCELLED" },
    });
    if (claimed.count !== 1) {
      throw new ConflictError("Prescription status changed before it could be cancelled");
    }

    const row = await tx.prescription.findFirst({
      where: { id, branchId: existing.branchId },
      select: PRESCRIPTION_DETAIL_SELECT,
    });
    if (!row) throw new NotFoundError("Prescription not found");
    return row;
  });

  await writeAuditLog({
    module: "prescription",
    action: "cancel",
    tableName: "Prescription",
    recordId: String(id),
    oldValues: { status: existing.status },
    newValues: { status: "CANCELLED" },
    user: actor,
    branchId: existing.branchId,
  });

  return cancelled;
}
