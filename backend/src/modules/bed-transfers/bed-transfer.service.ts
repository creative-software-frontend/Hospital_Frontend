import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthorizationError, NotFoundError, ValidationError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type {
  CreateBedTransferInput,
  ListBedTransfersQuery,
  UpdateBedTransferInput,
} from "./bed-transfer.validation";

const BED_TRANSFER_SELECT: Prisma.BedTransferSelect = {
  id: true,
  branchId: true,
  patientId: true,
  admissionId: true,
  fromBedId: true,
  toBedId: true,
  transferDate: true,
  reason: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  patient: { select: { id: true, name: true, patientCode: true } },
  admission: { select: { id: true, admissionNumber: true, status: true } },
  fromBed: { select: { id: true, bedNumber: true, bedClass: true } },
  toBed: { select: { id: true, bedNumber: true, bedClass: true } },
  createdBy: { select: { id: true, name: true } },
};

type BedTransferRow = Prisma.BedTransferGetPayload<{ select: typeof BED_TRANSFER_SELECT }>;

function isSuperAdmin(actor: AuthUser) {
  return actor.roles.some((role) => role.seederKey === "SUPER_ADMIN");
}

function ensureBranch(actor: AuthUser, branchId: number) {
  if (actor.branchId !== branchId && !isSuperAdmin(actor)) {
    throw new AuthorizationError("You do not have permission to access these bed transfers");
  }
}

/** Local-midnight day bounds, matching the convention used by other date filters. */
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

export async function listBedTransfers(actor: AuthUser, query: ListBedTransfersQuery) {
  const { page, limit } = parsePagination(query as Record<string, unknown>);
  const branchId = actor.branchId;
  const baseWhere: Prisma.BedTransferWhereInput = { branchId, deletedAt: null };
  const where: Prisma.BedTransferWhereInput = { ...baseWhere };
  if (query.patientId) where.patientId = query.patientId;
  if (query.admissionId) where.admissionId = query.admissionId;
  const transferDate = dayRange(query.fromDate, query.toDate);
  if (transferDate) where.transferDate = transferDate;

  const [total, rows] = await Promise.all([
    prisma.bedTransfer.count({ where }),
    prisma.bedTransfer.findMany({
      where,
      select: BED_TRANSFER_SELECT,
      orderBy: [{ transferDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: rows,
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export async function getBedTransfer(actor: AuthUser, id: number) {
  const row = await prisma.bedTransfer.findFirst({
    where: { id, deletedAt: null },
    select: BED_TRANSFER_SELECT,
  });
  if (!row) throw new NotFoundError("Bed transfer not found");
  ensureBranch(actor, row.branchId);
  return row;
}

export async function createBedTransfer(actor: AuthUser, input: CreateBedTransferInput) {
  // Resolve the admission: use the provided one or find the patient's active admission
  let admissionId = input.admissionId;
  let patient: { id: number; branchId: number } | null = null;

  if (input.admissionId) {
    const admission = await prisma.admission.findFirst({
      where: { id: input.admissionId, deletedAt: null },
      select: { id: true, patientId: true, branchId: true, bedId: true, status: true },
    });
    if (!admission) throw new NotFoundError("Admission not found");
    patient = { id: admission.patientId, branchId: admission.branchId };
    admissionId = admission.id;
  } else {
    const activeAdmission = await prisma.admission.findFirst({
      where: { patientId: input.patientId, deletedAt: null, status: "ADMITTED" },
      select: { id: true, patientId: true, branchId: true, bedId: true, status: true },
    });
    if (!activeAdmission) {
      throw new ValidationError("Patient has no active admission");
    }
    admissionId = activeAdmission.id;
    patient = { id: activeAdmission.patientId, branchId: activeAdmission.branchId };
  }

  if (!patient) throw new NotFoundError("Patient not found");
  if (actor.branchId !== patient.branchId && !isSuperAdmin(actor)) {
    throw new AuthorizationError("Patient must belong to your branch");
  }

  // Validate source bed matches the admission's current bed
  const fromBed = await prisma.bed.findFirst({
    where: { id: input.fromBedId },
    select: { id: true, branchId: true, status: true, bedNumber: true },
  });
  if (!fromBed) throw new NotFoundError("Source bed not found");
  if (fromBed.status !== "occupied") {
    throw new ValidationError("Source bed is not currently occupied");
  }

  // Validate destination bed is available
  const toBed = await prisma.bed.findFirst({
    where: { id: input.toBedId },
    select: { id: true, branchId: true, status: true, bedNumber: true },
  });
  if (!toBed) throw new NotFoundError("Destination bed not found");
  if (toBed.status !== "available") {
    throw new ValidationError("Destination bed is not available");
  }
  if (toBed.branchId !== fromBed.branchId) {
    throw new ValidationError("Source and destination beds must be in the same branch");
  }

  const transferDate = input.transferDate ?? new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Create the transfer record
    const transfer = await tx.bedTransfer.create({
      data: {
        branchId: actor.branchId,
        patientId: input.patientId,
        admissionId,
        fromBedId: input.fromBedId,
        toBedId: input.toBedId,
        transferDate,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        createdByUserId: actor.id,
      },
      select: BED_TRANSFER_SELECT,
    });

    // Update admission to point to new bed
    await tx.admission.update({
      where: { id: admissionId },
      data: { bedId: input.toBedId, updatedById: actor.id },
    });

    // Free up source bed, occupy destination bed
    await tx.bed.update({
      where: { id: input.fromBedId },
      data: { status: "available" },
    });
    await tx.bed.update({
      where: { id: input.toBedId },
      data: { status: "occupied" },
    });

    return transfer;
  });

  await writeAuditLog({
    module: "bedTransfer",
    action: "create",
    tableName: "BedTransfer",
    recordId: String(result.id),
    newValues: {
      patientId: input.patientId,
      admissionId,
      fromBedId: input.fromBedId,
      toBedId: input.toBedId,
      transferDate,
    },
    user: actor,
    branchId: actor.branchId,
  });

  return result;
}

export async function updateBedTransfer(actor: AuthUser, id: number, input: UpdateBedTransferInput) {
  const existing = await prisma.bedTransfer.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!existing) throw new NotFoundError("Bed transfer not found");
  ensureBranch(actor, existing.branchId);

  const row = await prisma.bedTransfer.update({
    where: { id },
    data: {
      ...(input.reason !== undefined ? { reason: input.reason ?? null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
    },
    select: BED_TRANSFER_SELECT,
  });

  await writeAuditLog({
    module: "bedTransfer",
    action: "update",
    tableName: "BedTransfer",
    recordId: String(id),
    newValues: input as Prisma.InputJsonValue,
    user: actor,
    branchId: existing.branchId,
  });

  return row;
}

export async function deleteBedTransfer(actor: AuthUser, id: number) {
  const existing = await prisma.bedTransfer.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!existing) throw new NotFoundError("Bed transfer not found");
  ensureBranch(actor, existing.branchId);
  await prisma.bedTransfer.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAuditLog({
    module: "bedTransfer",
    action: "delete",
    tableName: "BedTransfer",
    recordId: String(id),
    user: actor,
    branchId: existing.branchId,
  });
}
