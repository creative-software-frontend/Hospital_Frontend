import { prisma } from "../../lib/prisma";
import { AuthorizationError, NotFoundError, ValidationError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { parsePagination, buildPaginationMeta } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import {
  BED_WARD_DELEGATES,
  BED_WARD_SPECS,
  type BedWardKind,
  type BedWardSpec,
} from "./bedWard.registry";
import type {
  CreateBedWardInput,
  ListBedWardQuery,
  UpdateBedWardInput,
} from "./bedWard.validation";

/** Columns present on every list (plus the FK columns used to sort "beds"). */
const SORTABLE = new Set([
  "id",
  "name",
  "branchId",
  "floorId",
  "bedTypeId",
  "bedGroupId",
  "createdAt",
  "updatedAt",
]);

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

/** Verifies each FK on the input points at an existing row in the same branch. */
async function ensureRelations(
  spec: BedWardSpec,
  input: Record<string, unknown>,
  branchId: number,
): Promise<void> {
  for (const rel of spec.relations) {
    const value = input[rel.field];
    if (value === undefined || value === null) continue;
    const target = BED_WARD_SPECS[rel.targetKind];
    const found = await BED_WARD_DELEGATES[rel.targetKind].findUnique({
      where: { id: Number(value) },
      select: { id: true, branchId: true },
    });
    if (!found) {
      throw new NotFoundError(`${target.label} not found`);
    }
    if (found.branchId !== branchId) {
      throw new ValidationError(`${target.label} does not belong to this branch`);
    }
  }
}

export async function listBedWard(actor: AuthUser, kind: BedWardKind, query: ListBedWardQuery) {
  assertSuperAdmin(actor);
  const spec = BED_WARD_SPECS[kind];
  const delegate = BED_WARD_DELEGATES[kind];
  const { page, limit, search, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);
  const orderField = typeof sortBy === "string" && SORTABLE.has(sortBy) ? sortBy : "name";

  const where: Record<string, unknown> = {};
  if (query.branchId) where.branchId = query.branchId;
  if (search) {
    where.OR = spec.searchFields.map((field) => ({ [field]: { contains: search } }));
  }

  const [total, rows] = await Promise.all([
    delegate.count({ where }),
    delegate.findMany({
      where,
      select: spec.select,
      orderBy: { [orderField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getBedWard(actor: AuthUser, kind: BedWardKind, id: number) {
  assertSuperAdmin(actor);
  const spec = BED_WARD_SPECS[kind];
  const row = await BED_WARD_DELEGATES[kind].findUnique({
    where: { id },
    select: spec.select,
  });
  if (!row) {
    throw new NotFoundError(`${spec.label} not found`);
  }
  return row;
}

export async function createBedWard(actor: AuthUser, kind: BedWardKind, input: CreateBedWardInput) {
  assertSuperAdmin(actor);
  const spec = BED_WARD_SPECS[kind];
  const delegate = BED_WARD_DELEGATES[kind];
  await ensureBranch(input.branchId);
  await ensureRelations(spec, input as unknown as Record<string, unknown>, input.branchId);

  const row = await delegate.create({
    data: { ...input },
    select: spec.select,
  });

  await writeAuditLog({
    module: spec.module,
    action: "create",
    tableName: spec.tableName,
    recordId: String(row.id),
    newValues: { ...input },
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
    select: { id: true, branchId: true, name: true },
  });
  if (!current) {
    throw new NotFoundError(`${spec.label} not found`);
  }

  await ensureRelations(spec, input as unknown as Record<string, unknown>, current.branchId);

  const row = await delegate.update({
    where: { id },
    data: { ...input },
    select: spec.select,
  });

  await writeAuditLog({
    module: spec.module,
    action: "update",
    tableName: spec.tableName,
    recordId: String(id),
    oldValues: { name: current.name },
    newValues: { ...input },
    user: actor,
    branchId: current.branchId,
  });

  return row;
}
