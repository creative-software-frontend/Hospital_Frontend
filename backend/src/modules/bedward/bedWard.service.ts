import { prisma } from "../../lib/prisma";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { parsePagination, buildPaginationMeta } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import {
  BED_WARD_DELEGATES,
  BED_WARD_SELECT,
  BED_WARD_SPECS,
  type BedWardKind,
} from "./bedWard.registry";
import type {
  CreateBedWardInput,
  ListBedWardQuery,
  UpdateBedWardInput,
} from "./bedWard.validation";

/** Only these columns exist on all four lists, so only these may be sorted on. */
const SORTABLE = new Set(["id", "name", "code", "branchId", "createdAt", "updatedAt"]);

function assertSuperAdmin(actor: AuthUser): void {
  if (!actor.roles.some((r) => r.seederKey === "SUPER_ADMIN")) {
    throw new AuthorizationError("SUPER_ADMIN role required");
  }
}

async function ensureBranch(id: number): Promise<void> {
  const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
  if (!branch) {
    throw new NotFoundError("Branch not found");
  }
}

export async function listBedWard(actor: AuthUser, kind: BedWardKind, query: ListBedWardQuery) {
  assertSuperAdmin(actor);
  const delegate = BED_WARD_DELEGATES[kind];
  const { page, limit, search, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);
  const orderField = typeof sortBy === "string" && SORTABLE.has(sortBy) ? sortBy : "name";

  const where: Record<string, unknown> = {};
  if (query.branchId) where.branchId = query.branchId;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    delegate.count({ where }),
    delegate.findMany({
      where,
      select: BED_WARD_SELECT,
      orderBy: { [orderField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getBedWard(actor: AuthUser, kind: BedWardKind, id: number) {
  assertSuperAdmin(actor);
  const row = await BED_WARD_DELEGATES[kind].findUnique({
    where: { id },
    select: BED_WARD_SELECT,
  });
  if (!row) {
    throw new NotFoundError(`${BED_WARD_SPECS[kind].label} not found`);
  }
  return row;
}

export async function createBedWard(actor: AuthUser, kind: BedWardKind, input: CreateBedWardInput) {
  assertSuperAdmin(actor);
  const spec = BED_WARD_SPECS[kind];
  const delegate = BED_WARD_DELEGATES[kind];
  await ensureBranch(input.branchId);

  const existing = await delegate.findFirst({
    where: { branchId: input.branchId, code: input.code },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(`${spec.label} code "${input.code}" already exists in this branch`);
  }

  const row = await delegate.create({
    data: {
      branchId: input.branchId,
      name: input.name,
      code: input.code,
      description: input.description,
    },
    select: BED_WARD_SELECT,
  });

  await writeAuditLog({
    module: spec.module,
    action: "create",
    tableName: spec.tableName,
    recordId: String(row.id),
    newValues: { name: row.name, code: row.code, branchId: input.branchId },
    user: actor,
    branchId: input.branchId,
  });

  return row;
}

export async function updateBedWard(
  actor: AuthUser,
  kind: BedWardKind,
  id: number,
  input: UpdateBedWardInput,
) {
  assertSuperAdmin(actor);
  const spec = BED_WARD_SPECS[kind];
  const delegate = BED_WARD_DELEGATES[kind];

  const current = await delegate.findUnique({
    where: { id },
    select: { id: true, branchId: true, name: true, code: true },
  });
  if (!current) {
    throw new NotFoundError(`${spec.label} not found`);
  }

  const row = await delegate.update({
    where: { id },
    data: { ...input },
    select: BED_WARD_SELECT,
  });

  await writeAuditLog({
    module: spec.module,
    action: "update",
    tableName: spec.tableName,
    recordId: String(id),
    oldValues: { name: current.name, code: current.code },
    newValues: { ...input },
    user: actor,
    branchId: current.branchId,
  });

  return row;
}
