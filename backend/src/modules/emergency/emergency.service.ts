// modules/emergency/emergency.service.ts
// Emergency desk: fast patient intake plus the "needs completing" ledger.
//
// The patient row is created through the patient module's own `createPatient`
// so the branch's Patient Configuration (auto-generated ID, duplicates, audit
// trail) still applies — this desk only decides *how little* it asks for. The
// required-demographic / guardian rules are skipped (`forEmergency`), because
// those are exactly the fields the queue flags as "missing" until they are known.

import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { writeAuditLog } from "../../utils/audit";
import { CODE_ENTITIES, generateBusinessCode } from "../../utils/codeGenerator";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import * as patientService from "../patients/patient.service";
import type { CreatePatientInput } from "../patients/patient.validation";
import type { CreateEmergencyCaseInput, ListEmergencyCasesQuery } from "./emergency.validation";

/** Patient fields the queue row needs to decide what is still missing. */
const EMERGENCY_PATIENT_SELECT = {
  id: true,
  patientCode: true,
  name: true,
  gender: true,
  dateOfBirth: true,
  phone: true,
  address: true,
} as const;

const EMERGENCY_CASE_SELECT = {
  id: true,
  caseNumber: true,
  priority: true,
  chiefComplaint: true,
  unidentified: true,
  arrivedAt: true,
  createdAt: true,
  patient: { select: EMERGENCY_PATIENT_SELECT },
} as const;

type EmergencyPatientRow = Prisma.EmergencyCaseGetPayload<{
  select: { patient: { select: typeof EMERGENCY_PATIENT_SELECT } };
}>["patient"];

/** Fields the queue still wants before the record counts as complete. */
export function missingPatientFields(patient: EmergencyPatientRow): string[] {
  const missing: string[] = [];
  if (!patient.gender) missing.push("Gender");
  if (!patient.dateOfBirth) missing.push("Date of birth");
  if (!patient.phone) missing.push("Phone");
  if (!patient.address) missing.push("Address");
  return missing;
}

function withMissing(patient: EmergencyPatientRow) {
  return { ...patient, missing: missingPatientFields(patient) };
}

/** Prisma filter matching a patient row that still misses a core field. */
const INCOMPLETE_PATIENT_FILTER: Prisma.PatientWhereInput = {
  OR: [
    { gender: null },
    { dateOfBirth: null },
    { phone: null },
    { address: null },
  ],
};

/** `YYYY-MM-DD` in local time — the same day the desk's `<input type="date">` shows. */
function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Approximate age → estimated date of birth (1 January of the birth year). The
 * real date replaces it when the record is completed.
 */
function estimatedDateOfBirth(age: number): Date {
  return new Date(new Date().getFullYear() - age, 0, 1);
}

/**
 * Register a walk-in emergency: create the patient with the minimum the desk
 * captured, then the triage case that carries the emergency context.
 */
export async function registerEmergencyCase(
  actor: AuthUser,
  input: CreateEmergencyCaseInput,
) {
  const branchId = actor.branchId;

  const { patient: quick } = input;
  const dateOfBirth =
    quick.approxAge !== undefined ? estimatedDateOfBirth(quick.approxAge) : undefined;

  const patientInput: CreatePatientInput = {
    name: quick.name,
    ...(quick.gender ? { gender: quick.gender } : {}),
    ...(dateOfBirth ? { dateOfBirth } : {}),
  };

  const patient = await patientService.createPatient(actor, patientInput, {
    forEmergency: true,
  });

  let emergencyCase;
  try {
    emergencyCase = await prisma.$transaction(async (tx) => {
      const caseNumber = await generateBusinessCode(tx, CODE_ENTITIES.EMERGENCY, branchId, {
        prefix: "EMR",
      });
      return tx.emergencyCase.create({
        data: {
          branchId,
          patientId: patient.id,
          caseNumber,
          priority: input.priority,
          chiefComplaint: input.chiefComplaint ?? null,
          unidentified: input.unidentified ?? false,
          registeredById: actor.id,
        },
        select: EMERGENCY_CASE_SELECT,
      });
    });
  } catch (err) {
    // The patient row is already committed. If the case cannot be written the
    // intake never happened, so retire the patient instead of leaving an
    // orphan with no emergency context.
    await prisma.patient
      .update({ where: { id: patient.id }, data: { deletedAt: new Date() } })
      .catch(() => undefined);
    throw err;
  }

  await writeAuditLog({
    module: "EMERGENCY",
    action: "EMERGENCY_CASE_REGISTERED",
    tableName: "EmergencyCase",
    recordId: String(emergencyCase.id),
    newValues: {
      caseNumber: emergencyCase.caseNumber,
      patientCode: emergencyCase.patient.patientCode,
      patientId: emergencyCase.patient.id,
      priority: emergencyCase.priority,
      unidentified: emergencyCase.unidentified,
      branchId,
    },
    user: actor,
    branchId,
  });

  return {
    emergencyCase: {
      ...emergencyCase,
      patient: withMissing(emergencyCase.patient),
    },
    duplicateWarnings: patient.duplicateWarnings,
  };
}

/**
 * One day of registrations (today by default), newest first. The summary is
 * computed over the whole day so the header counter does not move when the
 * "still needs details" filter is applied.
 */
export async function listEmergencyCases(actor: AuthUser, query: ListEmergencyCasesQuery) {
  const branchId = actor.branchId;
  const day = query.date ?? toIsoDay(new Date());
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { page, limit } = parsePagination(query as Record<string, unknown>);

  const dayWhere: Prisma.EmergencyCaseWhereInput = {
    branchId,
    deletedAt: null,
    arrivedAt: { gte: start, lt: end },
  };

  const where: Prisma.EmergencyCaseWhereInput = {
    ...dayWhere,
    ...(query.incomplete === true ? { patient: INCOMPLETE_PATIENT_FILTER } : {}),
  };

  const [total, rows, dayTotal, needsInfo] = await Promise.all([
    prisma.emergencyCase.count({ where }),
    prisma.emergencyCase.findMany({
      where,
      select: EMERGENCY_CASE_SELECT,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ arrivedAt: "desc" }, { id: "desc" }],
    }),
    prisma.emergencyCase.count({ where: dayWhere }),
    prisma.emergencyCase.count({
      where: { ...dayWhere, patient: INCOMPLETE_PATIENT_FILTER },
    }),
  ]);

  return {
    data: rows.map((row) => ({ ...row, patient: withMissing(row.patient) })),
    pagination: buildPaginationMeta(page, limit, total),
    summary: {
      date: day,
      total: dayTotal,
      needsInfo,
    },
  };
}
