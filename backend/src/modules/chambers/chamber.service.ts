import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthorizationError, ConflictError, NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { parsePagination, buildPaginationMeta, type SortableField } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type { CreateChamberInput, ListChambersQuery, UpdateChamberInput } from "./chamber.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

function resolveBranchId(actor: AuthUser): number {
  return actor.branchId;
}

async function ensureBranch(id: number): Promise<void> {
  const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
  if (!branch) throw new NotFoundError("Branch not found");
}

async function getAccessibleChamber(actor: AuthUser, id: number) {
  const row = await prisma.chamber.findFirst({ where: { id }, select: { id: true, branchId: true } });
  if (!row) throw new NotFoundError("Chamber not found");
  if (!isSuperAdmin(actor) && actor.branchId !== row.branchId) {
    throw new AuthorizationError("You do not have permission to access this chamber");
  }
  return row;
}

async function ensureDoctor(actor: AuthUser, doctorId: number | null | undefined, branchId: number) {
  if (doctorId == null) return;
  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId }, select: { id: true, branchId: true } });
  if (!doctor) throw new NotFoundError("Doctor not found");
  if (doctor.branchId !== branchId) {
    throw new AuthorizationError("Doctor does not belong to this branch");
  }
}

const CHAMBER_SELECT: Prisma.ChamberSelect = {
  id: true,
  branchId: true,
  name: true,
  code: true,
  location: true,
  description: true,
  doctorId: true,
  status: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  doctor: { select: { id: true, name: true, doctorCode: true } },
};

export async function listChambers(actor: AuthUser, query: ListChambersQuery) {
  const { page, limit, search, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);
  const branchId = resolveBranchId(actor);

  const where: Prisma.ChamberWhereInput = { branchId, deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.doctorId) where.doctorId = query.doctorId;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
      { location: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.chamber.count({ where }),
    prisma.chamber.findMany({
      where,
      select: CHAMBER_SELECT,
      orderBy: { [sortBy as SortableField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getChamber(actor: AuthUser, id: number) {
  await getAccessibleChamber(actor, id);
  return prisma.chamber.findUnique({ where: { id }, select: CHAMBER_SELECT });
}

export async function createChamber(actor: AuthUser, input: CreateChamberInput) {
  const branchId = resolveBranchId(actor);
  await ensureBranch(branchId);
  await ensureDoctor(actor, input.doctorId ?? null, branchId);

  const existing = await prisma.chamber.findFirst({
    where: { branchId, code: input.code },
    select: { id: true },
  });
  if (existing) throw new ConflictError(`Chamber code "${input.code}" already exists in this branch`);

  const row = await prisma.chamber.create({
    data: {
      branchId,
      name: input.name,
      code: input.code,
      location: input.location,
      description: input.description,
      doctorId: input.doctorId ?? null,
      status: input.status ?? "active",
    },
    select: CHAMBER_SELECT,
  });

  await writeAuditLog({
    module: "chamber",
    action: "create",
    tableName: "Chamber",
    recordId: String(row.id),
    newValues: { name: row.name, code: row.code, branchId },
    user: actor,
    branchId,
  });

  return row;
}

export async function updateChamber(actor: AuthUser, id: number, input: UpdateChamberInput) {
  const access = await getAccessibleChamber(actor, id);
  if (input.doctorId !== undefined) {
    await ensureDoctor(actor, input.doctorId, access.branchId);
  }

  const updated = await prisma.chamber.update({
    where: { id },
    data: { ...input },
    select: CHAMBER_SELECT,
  });

  await writeAuditLog({
    module: "chamber",
    action: "update",
    tableName: "Chamber",
    recordId: String(id),
    newValues: { ...input },
    user: actor,
    branchId: access.branchId,
  });

  return updated;
}

export async function deleteChamber(actor: AuthUser, id: number) {
  const access = await getAccessibleChamber(actor, id);
  await prisma.chamber.update({ where: { id }, data: { deletedAt: new Date(), status: "inactive" } });

  await writeAuditLog({
    module: "chamber",
    action: "delete",
    tableName: "Chamber",
    recordId: String(id),
    user: actor,
    branchId: access.branchId,
  });
}
