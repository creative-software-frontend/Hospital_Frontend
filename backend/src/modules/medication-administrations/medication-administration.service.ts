import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthorizationError, NotFoundError, ValidationError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type {
  CreateMedicationAdministrationInput,
  ListMedicationAdministrationsQuery,
  ListPrescribedMedicationsQuery,
  MedicationAdministrationStatusValue,
  PrescribedMedicationRow,
  UpdateMedicationAdministrationInput,
} from "./medication-administration.validation";

const MED_ADMIN_SELECT: Prisma.MedicationAdministrationSelect = {
  id: true,
  branchId: true,
  patientId: true,
  prescriptionItemId: true,
  medicineId: true,
  nurseId: true,
  admissionId: true,
  medicineName: true,
  dosage: true,
  route: true,
  administeredAt: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
  patient: { select: { id: true, name: true, patientCode: true } },
  nurse: { select: { id: true, name: true, nurseCode: true } },
  admission: { select: { id: true, admissionNumber: true, status: true } },
  prescriptionItem: {
    select: {
      id: true,
      medicineId: true,
      medicine: { select: { id: true, genericName: true, brandName: true, medicineCode: true } },
    },
  },
};

type MedicationAdministrationRow = Prisma.MedicationAdministrationGetPayload<{
  select: typeof MED_ADMIN_SELECT;
}>;

const STATUSES: MedicationAdministrationStatusValue[] = ["GIVEN", "HELD", "REFUSED", "MISSED"];

function isSuperAdmin(actor: AuthUser) {
  return actor.roles.some((role) => role.seederKey === "SUPER_ADMIN");
}

function ensureBranch(actor: AuthUser, branchId: number) {
  if (actor.branchId !== branchId && !isSuperAdmin(actor)) {
    throw new AuthorizationError("You do not have permission to access these medication administrations");
  }
}

async function ensureNurseBranch(nurseId: number | null | undefined, patientBranchId: number) {
  if (!nurseId) return null;
  const nurse = await prisma.nurse.findFirst({
    where: { id: nurseId, deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!nurse) throw new NotFoundError("Nurse not found");
  if (nurse.branchId !== patientBranchId) {
    throw new AuthorizationError("Nurse must belong to the patient's branch");
  }
  return nurse;
}

/** Local-midnight day bounds, matching the convention used by the other date filters. */
function dayRange(from?: string, to?: string) {
  const range: Prisma.DateTimeFilter = {};
  let start: Date | undefined;
  let end: Date | undefined;
  if (from) {
    start = new Date(`${from}T00:00:00`);
    if (Number.isNaN(start.getTime())) throw new ValidationError("`from` must be a valid date");
    range.gte = start;
  }
  if (to) {
    end = new Date(`${to}T00:00:00`);
    if (Number.isNaN(end.getTime())) throw new ValidationError("`to` must be a valid date");
    end.setDate(end.getDate() + 1);
    range.lt = end;
  }
  if (start && end && start >= end) {
    throw new ValidationError("`from` must be on or before `to`");
  }
  return Object.keys(range).length > 0 ? range : undefined;
}

export async function listMedicationAdministrations(actor: AuthUser, query: ListMedicationAdministrationsQuery) {
  const { page, limit } = parsePagination(query as Record<string, unknown>);
  const branchId = actor.branchId;
  const baseWhere: Prisma.MedicationAdministrationWhereInput = { branchId, deletedAt: null };
  const where: Prisma.MedicationAdministrationWhereInput = { ...baseWhere };
  if (query.patientId) where.patientId = query.patientId;
  if (query.status) where.status = query.status;
  const administeredAt = dayRange(query.from, query.to);
  if (administeredAt) where.administeredAt = administeredAt;

  const [total, rows] = await Promise.all([
    prisma.medicationAdministration.count({ where }),
    prisma.medicationAdministration.findMany({
      where,
      select: MED_ADMIN_SELECT,
      orderBy: [{ administeredAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  if (!query.patientId) {
    return { data: rows, pagination: buildPaginationMeta(page, limit, total), summary: null };
  }

  // Summary covers the patient's whole history so the stat tiles do not jump
  // when the nurse narrows the date filter.
  const [historyTotal, grouped, lastGiven] = await Promise.all([
    prisma.medicationAdministration.count({ where: baseWhere }),
    prisma.medicationAdministration.groupBy({
      by: ["status"],
      where: { ...baseWhere, patientId: query.patientId },
      _count: { _all: true },
    }),
    prisma.medicationAdministration.findFirst({
      where: { ...baseWhere, patientId: query.patientId, status: "GIVEN" },
      select: { administeredAt: true },
      orderBy: [{ administeredAt: "desc" }, { id: "desc" }],
    }),
  ]);

  const counts: Record<MedicationAdministrationStatusValue, number> = {
    GIVEN: 0,
    HELD: 0,
    REFUSED: 0,
    MISSED: 0,
  };
  for (const entry of grouped) {
    counts[entry.status as MedicationAdministrationStatusValue] = entry._count._all;
  }

  return {
    data: rows,
    pagination: buildPaginationMeta(page, limit, total),
    summary: {
      total: historyTotal,
      given: counts.GIVEN,
      held: counts.HELD,
      refused: counts.REFUSED,
      missed: counts.MISSED,
      lastGivenAt: lastGiven ? lastGiven.administeredAt.toISOString() : null,
    },
  };
}

export async function getMedicationAdministration(actor: AuthUser, id: number) {
  const row = await prisma.medicationAdministration.findFirst({
    where: { id, deletedAt: null },
    select: MED_ADMIN_SELECT,
  });
  if (!row) throw new NotFoundError("Medication administration not found");
  ensureBranch(actor, row.branchId);
  const { patient, nurse, admission, ...rest } = row;
  return rest;
}

export async function listPrescribedMedications(actor: AuthUser, query: ListPrescribedMedicationsQuery) {
  const patient = await prisma.patient.findFirst({
    where: { id: query.patientId, deletedAt: null },
    select: { id: true, branchId: true, name: true, patientCode: true },
  });
  if (!patient) throw new NotFoundError("Patient not found");
  if (actor.branchId !== patient.branchId && !isSuperAdmin(actor)) {
    throw new AuthorizationError("Patient must belong to your branch");
  }
  const status = query.status && query.status !== "ACTIVE" ? query.status : "ACTIVE";

  const prescriptions = await prisma.prescription.findMany({
    where: { branchId: patient.branchId, patientId: patient.id, status },
    select: {
      id: true,
      prescriptionNumber: true,
      status: true,
      items: {
        select: {
          id: true,
          medicineId: true,
          dosage: true,
          frequency: true,
          duration: true,
          instruction: true,
          route: true,
          quantity: true,
          medicine: { select: { id: true, genericName: true, brandName: true, medicineCode: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const rows: PrescribedMedicationRow[] = prescriptions.flatMap((prescription) =>
    prescription.items.map((item) => ({
      prescriptionId: prescription.id,
      prescriptionNumber: prescription.prescriptionNumber,
      prescriptionStatus: prescription.status,
      itemId: item.id,
      medicineId: item.medicineId,
      medicineName: item.medicine?.genericName ?? item.medicine?.brandName ?? "",
      medicineCode: item.medicine?.medicineCode ?? null,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      instruction: item.instruction,
      route: item.route,
      quantity: item.quantity,
    })),
  );

  return {
    rows,
    patient: { id: patient.id, name: patient.name, patientCode: patient.patientCode },
  };
}

export async function createMedicationAdministration(actor: AuthUser, input: CreateMedicationAdministrationInput) {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!patient) throw new NotFoundError("Patient not found");
  if (actor.branchId !== patient.branchId && !isSuperAdmin(actor)) {
    throw new AuthorizationError("Patient must belong to your branch");
  }

  let medicineId = input.medicineId ?? null;
  let medicineName = input.medicineName?.trim() ?? null;
  let dosage = input.dosage ?? null;
  let route = input.route ?? null;
  let prescriptionItemId = input.prescriptionItemId ?? null;

  if (input.prescriptionItemId) {
    const item = await prisma.prescriptionItem.findFirst({
      where: {
        id: input.prescriptionItemId,
        prescription: { branchId: patient.branchId, patientId: patient.id },
      },
      select: {
        id: true,
        medicineId: true,
        dosage: true,
        route: true,
        medicine: { select: { id: true, genericName: true, brandName: true, medicineCode: true } },
      },
    });
    if (!item) throw new NotFoundError("Prescription item not found");
    prescriptionItemId = item.id;
    medicineId = item.medicineId;
    medicineName = item.medicine?.genericName ?? item.medicine?.brandName ?? null;
    dosage = item.dosage ?? input.dosage ?? null;
    route = item.route ?? input.route ?? null;
  }

  if (!medicineName) {
    throw new ValidationError("Medicine name is required when no prescription item is linked");
  }

  const nurse = await ensureNurseBranch(input.nurseId, patient.branchId);
  const admission = input.admissionId
    ? await prisma.admission.findFirst({
        where: { id: input.admissionId, deletedAt: null },
        select: { id: true, branchId: true, patientId: true },
      })
    : null;

  if (admission && (admission.branchId !== patient.branchId || admission.patientId !== patient.id)) {
    throw new AuthorizationError("Admission does not belong to this patient");
  }

  const row = await prisma.medicationAdministration.create({
    data: {
      branchId: actor.branchId,
      patientId: input.patientId,
      prescriptionItemId,
      medicineId,
      nurseId: nurse?.id ?? null,
      admissionId: admission?.id ?? null,
      medicineName: medicineName,
      dosage,
      route,
      administeredAt: input.administeredAt ?? new Date(),
      status: input.status ?? "GIVEN",
      notes: input.notes ?? null,
      createdByUserId: actor.id,
    },
    select: MED_ADMIN_SELECT,
  });

  await writeAuditLog({
    module: "medicationAdministration",
    action: "create",
    tableName: "MedicationAdministration",
    recordId: String(row.id),
    newValues: {
      patientId: row.patientId,
      prescriptionItemId: row.prescriptionItemId,
      medicineId: row.medicineId,
      medicineName: row.medicineName,
      status: row.status,
    },
    user: actor,
    branchId: actor.branchId,
  });

  const created = await prisma.medicationAdministration.findFirst({
    where: { id: row.id, deletedAt: null },
    select: MED_ADMIN_SELECT,
  });
  return created;
}

export async function updateMedicationAdministration(actor: AuthUser, id: number, input: UpdateMedicationAdministrationInput) {
  const existing = await prisma.medicationAdministration.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, branchId: true, patientId: true, nurseId: true },
  });
  if (!existing) throw new NotFoundError("Medication administration not found");
  ensureBranch(actor, existing.branchId);

  const row = await prisma.medicationAdministration.update({
    where: { id },
    data: {
      ...(input.nurseId !== undefined ? { nurseId: input.nurseId ?? null } : {}),
      ...(input.admissionId !== undefined ? { admissionId: input.admissionId ?? null } : {}),
      ...(input.administeredAt !== undefined ? { administeredAt: input.administeredAt ?? new Date() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      ...(input.dosage !== undefined ? { dosage: input.dosage ?? null } : {}),
      ...(input.route !== undefined ? { route: input.route ?? null } : {}),
    },
    select: MED_ADMIN_SELECT,
  });

  await writeAuditLog({
    module: "medicationAdministration",
    action: "update",
    tableName: "MedicationAdministration",
    recordId: String(id),
    newValues: input as Prisma.InputJsonValue,
    user: actor,
    branchId: existing.branchId,
  });

  const updated = await prisma.medicationAdministration.findFirst({ where: { id, deletedAt: null }, select: MED_ADMIN_SELECT });
  return updated;
}

export async function deleteMedicationAdministration(actor: AuthUser, id: number) {
  const existing = await prisma.medicationAdministration.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!existing) throw new NotFoundError("Medication administration not found");
  ensureBranch(actor, existing.branchId);
  await prisma.medicationAdministration.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAuditLog({
    module: "medicationAdministration",
    action: "delete",
    tableName: "MedicationAdministration",
    recordId: String(id),
    user: actor,
    branchId: existing.branchId,
  });
}
