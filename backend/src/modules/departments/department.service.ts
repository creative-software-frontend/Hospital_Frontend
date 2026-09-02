import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { parsePagination, buildPaginationMeta, type SortableField } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type {
  CreateDepartmentInput,
  ListDepartmentsQuery,
  UpdateDepartmentInput,
} from "./department.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

function resolveBranchId(actor: AuthUser, explicit?: number): number {
  return actor.branchId;
}

async function ensureBranch(id: number): Promise<void> {
  const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
  if (!branch) {
    throw new NotFoundError("Branch not found");
  }
}

async function getAccessibleDepartment(actor: AuthUser, id: number) {
  const row = await prisma.department.findFirst({ where: { id }, select: { id: true, branchId: true } });
  if (!row) {
    throw new NotFoundError("Department not found");
  }
  if (!isSuperAdmin(actor) && actor.branchId !== row.branchId) {
    throw new AuthorizationError("You do not have permission to access this department");
  }
  return row;
}

const DEPARTMENT_SELECT: Prisma.DepartmentSelect = {
  id: true,
  branchId: true,
  name: true,
  code: true,
  description: true,
  departmentType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { doctors: true, services: true, employees: true },
  },
};

export async function listDepartments(actor: AuthUser, query: ListDepartmentsQuery) {
  const { page, limit, search, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);
  const branchId = resolveBranchId(actor);

  const where: Prisma.DepartmentWhereInput = { branchId };
  if (query.status) where.status = query.status;
  if (query.departmentType) where.departmentType = query.departmentType;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.department.count({ where }),
    prisma.department.findMany({
      where,
      select: DEPARTMENT_SELECT,
      orderBy: { [sortBy as SortableField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getDepartment(actor: AuthUser, id: number) {
  await getAccessibleDepartment(actor, id);
  return prisma.department.findUnique({ where: { id }, select: DEPARTMENT_SELECT });
}

export async function createDepartment(actor: AuthUser, input: CreateDepartmentInput) {
  const branchId = resolveBranchId(actor);
  await ensureBranch(branchId);

  const existing = await prisma.department.findFirst({
    where: { branchId, code: input.code },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(`Department code "${input.code}" already exists in this branch`);
  }

  const row = await prisma.department.create({
    data: {
      branchId,
      name: input.name,
      code: input.code,
      description: input.description,
      departmentType: input.departmentType,
      status: input.status ?? "active",
    },
  });

  await writeAuditLog({
    module: "department",
    action: "create",
    tableName: "Department",
    recordId: String(row.id),
    newValues: { name: row.name, code: row.code, branchId },
    user: actor,
    branchId,
  });

  return row;
}

export async function updateDepartment(actor: AuthUser, id: number, input: UpdateDepartmentInput) {
  await getAccessibleDepartment(actor, id);
  const current = await prisma.department.findUnique({ where: { id } });
  const updated = await prisma.department.update({
    where: { id },
    data: { ...input },
  });

  await writeAuditLog({
    module: "department",
    action: "update",
    tableName: "Department",
    recordId: String(id),
    oldValues: { name: current?.name, code: current?.code },
    newValues: { ...input },
    user: actor,
    branchId: current?.branchId,
  });

  return updated;
}