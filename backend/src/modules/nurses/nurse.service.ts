import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthorizationError, NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { CODE_ENTITIES, generateBusinessCode } from "../../utils/codeGenerator";
import { parsePagination, buildPaginationMeta, type SortableField } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type { CreateNurseInput, ListNursesQuery, UpdateNurseInput } from "./nurse.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

async function ensureBranch(id: number): Promise<void> {
  const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
  if (!branch) {
    throw new NotFoundError("Branch not found");
  }
}

/**
 * Confirms the referenced department and shift still exist before they are
 * written, so a nurse can never be filed under a dangling reference that would
 * only fail later as a foreign key error.
 */
async function ensureRefs(
  departmentId: number | null | undefined,
  shiftTypeId: number | null | undefined,
): Promise<void> {
  if (departmentId != null) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!department) {
      throw new NotFoundError("Department not found");
    }
  }
  if (shiftTypeId != null) {
    const shiftType = await prisma.shiftType.findUnique({
      where: { id: shiftTypeId },
      select: { id: true },
    });
    if (!shiftType) {
      throw new NotFoundError("Shift type not found");
    }
  }
}

async function getAccessibleNurse(actor: AuthUser, id: number) {
  const row = await prisma.nurse.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!row) {
    throw new NotFoundError("Nurse not found");
  }
  if (!isSuperAdmin(actor) && actor.branchId !== row.branchId) {
    throw new AuthorizationError("You do not have permission to access this nurse");
  }
  return row;
}

const NURSE_SELECT: Prisma.NurseSelect = {
  id: true,
  userId: true,
  branchId: true,
  departmentId: true,
  shiftTypeId: true,
  nurseCode: true,
  name: true,
  qualification: true,
  registrationNo: true,
  phone: true,
  email: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true, code: true } },
  shiftType: { select: { id: true, name: true } },
};

/**
 * Shift types are reference data owned by HR, but nothing else exposes them
 * yet, so the nurse form reads them from here. Declared before /:id in the
 * router so "shift-types" is not parsed as an id.
 */
export async function listShiftTypes() {
  const rows = await prisma.shiftType.findMany({
    where: { status: "active" },
    select: { id: true, name: true, startTime: true, endTime: true, graceMinutes: true, status: true },
    orderBy: { name: "asc" },
  });
  return rows;
}

export async function listNurses(actor: AuthUser, query: ListNursesQuery) {
  const { page, limit, search, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);
  const branchId = actor.branchId;

  const where: Prisma.NurseWhereInput = { branchId, deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.departmentId && Number.isInteger(Number(query.departmentId))) {
    where.departmentId = Number(query.departmentId);
  }
  if (query.shiftTypeId && Number.isInteger(Number(query.shiftTypeId))) {
    where.shiftTypeId = Number(query.shiftTypeId);
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { nurseCode: { contains: search } },
      { qualification: { contains: search } },
      { registrationNo: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.nurse.count({ where }),
    prisma.nurse.findMany({
      where,
      select: NURSE_SELECT,
      orderBy: { [sortBy as SortableField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getNurse(actor: AuthUser, id: number) {
  await getAccessibleNurse(actor, id);
  return prisma.nurse.findFirst({ where: { id, deletedAt: null }, select: NURSE_SELECT });
}

export async function createNurse(actor: AuthUser, input: CreateNurseInput) {
  await ensureBranch(actor.branchId);
  await ensureRefs(input.departmentId, input.shiftTypeId);

  // Claim the next branch-scoped nurse code and create the record in one
  // transaction: if creation fails the sequence increment rolls back too.
  const row = await prisma.$transaction(async (tx) => {
    const nurseCode = await generateBusinessCode(tx, CODE_ENTITIES.NURSE, actor.branchId);
    return tx.nurse.create({
      data: {
        branchId: actor.branchId,
        nurseCode,
        name: input.name,
        departmentId: input.departmentId ?? null,
        shiftTypeId: input.shiftTypeId ?? null,
        qualification: input.qualification,
        registrationNo: input.registrationNo,
        phone: input.phone,
        email: input.email,
        status: input.status ?? "active",
      },
    });
  });

  await writeAuditLog({
    module: "nurse",
    action: "create",
    tableName: "Nurse",
    recordId: String(row.id),
    newValues: { name: row.name, nurseCode: row.nurseCode, branchId: actor.branchId },
    user: actor,
    branchId: actor.branchId,
  });

  return row;
}

export async function updateNurse(actor: AuthUser, id: number, input: UpdateNurseInput) {
  const accessible = await getAccessibleNurse(actor, id);
  await ensureRefs(input.departmentId, input.shiftTypeId);

  const current = await prisma.nurse.findFirst({ where: { id } });
  const updated = await prisma.nurse.update({
    where: { id },
    data: { ...input },
  });

  await writeAuditLog({
    module: "nurse",
    action: "update",
    tableName: "Nurse",
    recordId: String(id),
    oldValues: { name: current?.name, nurseCode: current?.nurseCode },
    newValues: { ...input },
    user: actor,
    branchId: accessible.branchId,
  });

  return updated;
}
