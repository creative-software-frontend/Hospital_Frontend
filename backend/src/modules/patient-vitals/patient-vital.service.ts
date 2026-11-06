import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthorizationError, NotFoundError, ValidationError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type {
  CreatePatientVitalInput,
  ListPatientVitalsQuery,
  UpdatePatientVitalInput,
} from "./patient-vital.validation";

const VITAL_SELECT: Prisma.PatientVitalSelect = {
  id: true,
  branchId: true,
  patientId: true,
  nurseId: true,
  admissionId: true,
  recordedAt: true,
  temperature: true,
  pulse: true,
  systolic: true,
  diastolic: true,
  respiratoryRate: true,
  spo2: true,
  bloodSugar: true,
  weight: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  patient: { select: { id: true, name: true, patientCode: true } },
  nurse: { select: { id: true, name: true, nurseCode: true } },
  admission: { select: { id: true, admissionNumber: true, status: true } },
  createdBy: { select: { id: true, name: true } },
};

type VitalRow = Prisma.PatientVitalGetPayload<{ select: typeof VITAL_SELECT }>;

/** Adult reference ranges used to surface "needs attention" readings. */
const RANGES = {
  temperature: { low: 36.1, high: 37.5, label: "Temperature" },
  pulse: { low: 60, high: 100, label: "Pulse" },
  systolic: { low: 90, high: 140, label: "Systolic BP" },
  diastolic: { low: 60, high: 90, label: "Diastolic BP" },
  respiratoryRate: { low: 12, high: 20, label: "Respiration" },
  spo2: { low: 95, high: 100, label: "SpO2" },
  bloodSugar: { low: 70, high: 140, label: "Blood sugar" },
} as const;

type VitalMeasurements = Pick<
  VitalRow,
  "temperature" | "pulse" | "systolic" | "diastolic" | "respiratoryRate" | "spo2" | "bloodSugar"
>;

function numeric(value: Prisma.Decimal | number | null): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value.toString());
}

function decorate<T extends VitalMeasurements>(row: T) {
  const flags: string[] = [];
  (Object.keys(RANGES) as Array<keyof typeof RANGES>).forEach((key) => {
    const range = RANGES[key];
    const value = numeric(row[key]);
    if (value === null) return;
    if (value < range.low) flags.push(`${range.label} low`);
    if (value > range.high) flags.push(`${range.label} high`);
  });
  return { ...row, flags, abnormal: flags.length > 0 };
}

export type PatientVitalRecord = ReturnType<typeof decorate>;

function isSuperAdmin(actor: AuthUser) {
  return actor.roles.some((role) => role.seederKey === "SUPER_ADMIN");
}

function ensureBranch(actor: AuthUser, branchId: number) {
  if (actor.branchId !== branchId && !isSuperAdmin(actor)) {
    throw new AuthorizationError("You do not have permission to access these vitals");
  }
}

async function ensureReferences(
  actor: AuthUser,
  input: { patientId: number; nurseId?: number | null; admissionId?: number | null },
) {
  const [patient, nurse, admission] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: input.patientId, deletedAt: null },
      select: { id: true, branchId: true },
    }),
    input.nurseId
      ? prisma.nurse.findFirst({
          where: { id: input.nurseId, deletedAt: null },
          select: { id: true, branchId: true },
        })
      : Promise.resolve(null),
    input.admissionId
      ? prisma.admission.findFirst({
          where: { id: input.admissionId, deletedAt: null },
          select: { id: true, branchId: true, patientId: true },
        })
      : Promise.resolve(null),
  ]);

  if (!patient) throw new NotFoundError("Patient not found");
  if (input.nurseId && !nurse) throw new NotFoundError("Nurse not found");
  if (input.admissionId && !admission) throw new NotFoundError("Admission not found");
  if (!isSuperAdmin(actor) && patient.branchId !== actor.branchId) {
    throw new AuthorizationError("Patient must belong to your branch");
  }
  if (nurse && nurse.branchId !== patient.branchId) {
    throw new AuthorizationError("Nurse must belong to the patient's branch");
  }
  if (admission && (admission.branchId !== patient.branchId || admission.patientId !== patient.id)) {
    throw new AuthorizationError("Admission does not belong to this patient");
  }
  return { patient, nurse, admission };
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

export async function listPatientVitals(actor: AuthUser, query: ListPatientVitalsQuery) {
  const { page, limit } = parsePagination(query as Record<string, unknown>);
  const branchId = actor.branchId;
  const baseWhere: Prisma.PatientVitalWhereInput = { branchId, deletedAt: null };
  if (query.patientId) baseWhere.patientId = query.patientId;

  const where: Prisma.PatientVitalWhereInput = { ...baseWhere };
  const recordedAt = dayRange(query.from, query.to);
  if (recordedAt) where.recordedAt = recordedAt;

  const [total, rows] = await Promise.all([
    prisma.patientVital.count({ where }),
    prisma.patientVital.findMany({
      where,
      select: VITAL_SELECT,
      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  if (!query.patientId) {
    return { data: rows.map(decorate), pagination: buildPaginationMeta(page, limit, total), summary: null };
  }

  // Summary always covers the patient's whole history so the stat tiles do not
  // jump when the nurse narrows the date filter.
  const [historyTotal, latestRow, historyRows] = await Promise.all([
    prisma.patientVital.count({ where: baseWhere }),
    prisma.patientVital.findFirst({
      where: baseWhere,
      select: VITAL_SELECT,
      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
    }),
    prisma.patientVital.findMany({
      where: baseWhere,
      select: {
        temperature: true,
        pulse: true,
        systolic: true,
        diastolic: true,
        respiratoryRate: true,
        spo2: true,
        bloodSugar: true,
      },
      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
      take: 1000,
    }),
  ]);

  const abnormalCount = historyRows.filter((row) => decorate(row).abnormal).length;

  return {
    data: rows.map(decorate),
    pagination: buildPaginationMeta(page, limit, total),
    summary: {
      total: historyTotal,
      abnormalCount,
      latest: latestRow ? decorate(latestRow) : null,
    },
  };
}

export async function getPatientVital(actor: AuthUser, id: number) {
  const row = await prisma.patientVital.findFirst({
    where: { id, deletedAt: null },
    select: VITAL_SELECT,
  });
  if (!row) throw new NotFoundError("Vitals record not found");
  ensureBranch(actor, row.branchId);
  return decorate(row);
}

function buildMeasurements(input: CreatePatientVitalInput | UpdatePatientVitalInput) {
  return {
    ...(input.temperature !== undefined ? { temperature: new Prisma.Decimal(input.temperature) } : {}),
    ...(input.pulse !== undefined ? { pulse: Math.round(input.pulse) } : {}),
    ...(input.systolic !== undefined ? { systolic: Math.round(input.systolic) } : {}),
    ...(input.diastolic !== undefined ? { diastolic: Math.round(input.diastolic) } : {}),
    ...(input.respiratoryRate !== undefined ? { respiratoryRate: Math.round(input.respiratoryRate) } : {}),
    ...(input.spo2 !== undefined ? { spo2: Math.round(input.spo2) } : {}),
    ...(input.bloodSugar !== undefined ? { bloodSugar: new Prisma.Decimal(input.bloodSugar) } : {}),
    ...(input.weight !== undefined ? { weight: new Prisma.Decimal(input.weight) } : {}),
  };
}

export async function createPatientVital(actor: AuthUser, input: CreatePatientVitalInput) {
  await ensureReferences(actor, input);
  const row = await prisma.patientVital.create({
    data: {
      branchId: actor.branchId,
      patientId: input.patientId,
      nurseId: input.nurseId ?? null,
      admissionId: input.admissionId ?? null,
      recordedAt: input.recordedAt ?? new Date(),
      ...buildMeasurements(input),
      notes: input.notes ?? null,
      createdByUserId: actor.id,
    },
    select: VITAL_SELECT,
  });
  await writeAuditLog({
    module: "patientVital",
    action: "create",
    tableName: "PatientVital",
    recordId: String(row.id),
    newValues: {
      patientId: row.patientId,
      nurseId: row.nurseId,
      temperature: row.temperature?.toString() ?? null,
      pulse: row.pulse,
      systolic: row.systolic,
      diastolic: row.diastolic,
      spo2: row.spo2,
    },
    user: actor,
    branchId: actor.branchId,
  });
  return decorate(row);
}

export async function updatePatientVital(actor: AuthUser, id: number, input: UpdatePatientVitalInput) {
  const existing = await prisma.patientVital.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, branchId: true, patientId: true, nurseId: true },
  });
  if (!existing) throw new NotFoundError("Vitals record not found");
  ensureBranch(actor, existing.branchId);

  if (input.nurseId !== undefined || input.admissionId !== undefined) {
    await ensureReferences(actor, {
      patientId: existing.patientId,
      nurseId: input.nurseId ?? existing.nurseId,
      admissionId: input.admissionId,
    });
  }

  const row = await prisma.patientVital.update({
    where: { id },
    data: {
      ...(input.nurseId !== undefined ? { nurseId: input.nurseId ?? null } : {}),
      ...(input.admissionId !== undefined ? { admissionId: input.admissionId ?? null } : {}),
      ...(input.recordedAt !== undefined ? { recordedAt: input.recordedAt ?? new Date() } : {}),
      ...buildMeasurements(input),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
    },
    select: VITAL_SELECT,
  });

  await writeAuditLog({
    module: "patientVital",
    action: "update",
    tableName: "PatientVital",
    recordId: String(id),
    newValues: input as Prisma.InputJsonValue,
    user: actor,
    branchId: existing.branchId,
  });
  return decorate(row);
}

export async function deletePatientVital(actor: AuthUser, id: number) {
  const existing = await prisma.patientVital.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!existing) throw new NotFoundError("Vitals record not found");
  ensureBranch(actor, existing.branchId);
  await prisma.patientVital.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAuditLog({
    module: "patientVital",
    action: "delete",
    tableName: "PatientVital",
    recordId: String(id),
    user: actor,
    branchId: existing.branchId,
  });
}
