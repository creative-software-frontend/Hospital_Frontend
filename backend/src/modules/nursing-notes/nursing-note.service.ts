import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthorizationError, NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type { CreateNursingNoteInput, ListNursingNotesQuery, UpdateNursingNoteInput } from "./nursing-note.validation";

const NOTE_SELECT: Prisma.NursingNoteSelect = {
  id: true,
  branchId: true,
  patientId: true,
  nurseId: true,
  admissionId: true,
  noteType: true,
  note: true,
  observedAt: true,
  createdAt: true,
  updatedAt: true,
  patient: { select: { id: true, name: true, patientCode: true } },
  nurse: { select: { id: true, name: true, nurseCode: true } },
  admission: { select: { id: true, admissionNumber: true, status: true } },
};

function ensureBranch(actor: AuthUser, branchId: number) {
  if (actor.branchId !== branchId && !actor.roles.some((role) => role.seederKey === "SUPER_ADMIN")) {
    throw new AuthorizationError("You do not have permission to access this nursing note");
  }
}

async function ensureReferences(actor: AuthUser, input: { patientId: number; nurseId: number; admissionId?: number | null }) {
  const [patient, nurse, admission] = await Promise.all([
    prisma.patient.findFirst({ where: { id: input.patientId, deletedAt: null }, select: { id: true, branchId: true } }),
    prisma.nurse.findFirst({ where: { id: input.nurseId, deletedAt: null }, select: { id: true, branchId: true } }),
    input.admissionId
      ? prisma.admission.findFirst({ where: { id: input.admissionId, deletedAt: null }, select: { id: true, branchId: true, patientId: true } })
      : Promise.resolve(null),
  ]);
  if (!patient) throw new NotFoundError("Patient not found");
  if (!nurse) throw new NotFoundError("Nurse not found");
  if (patient.branchId !== actor.branchId || nurse.branchId !== actor.branchId) {
    throw new AuthorizationError("Patient and nurse must belong to your branch");
  }
  if (admission && (admission.branchId !== actor.branchId || admission.patientId !== patient.id)) {
    throw new AuthorizationError("Admission does not belong to this patient");
  }
  return { patient, nurse, admission };
}

export async function listNursingNotes(actor: AuthUser, query: ListNursingNotesQuery) {
  const { page, limit } = parsePagination(query as Record<string, unknown>);
  const where: Prisma.NursingNoteWhereInput = { branchId: actor.branchId, deletedAt: null };
  if (query.patientId) where.patientId = query.patientId;
  if (query.nurseId) where.nurseId = query.nurseId;
  if (query.search) {
    where.OR = [
      { note: { contains: query.search } },
      { noteType: { contains: query.search } },
      { patient: { name: { contains: query.search } } },
      { patient: { patientCode: { contains: query.search } } },
      { nurse: { name: { contains: query.search } } },
      { nurse: { nurseCode: { contains: query.search } } },
    ];
  }
  const [total, data] = await Promise.all([
    prisma.nursingNote.count({ where }),
    prisma.nursingNote.findMany({
      where,
      select: NOTE_SELECT,
      orderBy: [{ observedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { data, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getNursingNote(actor: AuthUser, id: number) {
  const row = await prisma.nursingNote.findFirst({ where: { id, deletedAt: null }, select: { branchId: true } });
  if (!row) throw new NotFoundError("Nursing note not found");
  ensureBranch(actor, row.branchId);
  return prisma.nursingNote.findUnique({ where: { id }, select: NOTE_SELECT });
}

export async function createNursingNote(actor: AuthUser, input: CreateNursingNoteInput) {
  await ensureReferences(actor, input);
  const row = await prisma.nursingNote.create({
    data: {
      branchId: actor.branchId,
      patientId: input.patientId,
      nurseId: input.nurseId,
      admissionId: input.admissionId ?? null,
      noteType: input.noteType,
      note: input.note,
      observedAt: input.observedAt ?? new Date(),
      createdByUserId: actor.id,
    },
    select: NOTE_SELECT,
  });
  await writeAuditLog({
    module: "nursingNote",
    action: "create",
    tableName: "NursingNote",
    recordId: String(row.id),
    newValues: { patientId: row.patientId, nurseId: row.nurseId, noteType: row.noteType },
    user: actor,
    branchId: actor.branchId,
  });
  return row;
}

export async function updateNursingNote(actor: AuthUser, id: number, input: UpdateNursingNoteInput) {
  const existing = await prisma.nursingNote.findFirst({ where: { id, deletedAt: null }, select: { branchId: true, patientId: true, nurseId: true } });
  if (!existing) throw new NotFoundError("Nursing note not found");
  ensureBranch(actor, existing.branchId);
  if (input.admissionId !== undefined) {
    await ensureReferences(actor, { patientId: existing.patientId, nurseId: existing.nurseId, admissionId: input.admissionId });
  }
  const row = await prisma.nursingNote.update({
    where: { id },
    data: {
      ...(input.admissionId !== undefined ? { admissionId: input.admissionId ?? null } : {}),
      ...(input.noteType !== undefined ? { noteType: input.noteType } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.observedAt !== undefined ? { observedAt: input.observedAt ?? new Date() } : {}),
    },
    select: NOTE_SELECT,
  });
  await writeAuditLog({ module: "nursingNote", action: "update", tableName: "NursingNote", recordId: String(id), newValues: input, user: actor, branchId: existing.branchId });
  return row;
}

export async function deleteNursingNote(actor: AuthUser, id: number) {
  const existing = await prisma.nursingNote.findFirst({ where: { id, deletedAt: null }, select: { branchId: true } });
  if (!existing) throw new NotFoundError("Nursing note not found");
  ensureBranch(actor, existing.branchId);
  await prisma.nursingNote.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAuditLog({ module: "nursingNote", action: "delete", tableName: "NursingNote", recordId: String(id), user: actor, branchId: existing.branchId });
}
