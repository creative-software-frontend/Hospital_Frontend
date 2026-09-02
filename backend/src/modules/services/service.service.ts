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
  CreateServiceInput,
  ListServicesQuery,
  UpdateServiceInput,
} from "./service.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

async function ensureBranch(id: number): Promise<void> {
  const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
  if (!branch) {
    throw new NotFoundError("Branch not found");
  }
}

async function getAccessibleService(actor: AuthUser, id: number) {
  const row = await prisma.service.findFirst({ where: { id }, select: { id: true, branchId: true } });
  if (!row) {
    throw new NotFoundError("Service not found");
  }
  if (!isSuperAdmin(actor) && actor.branchId !== row.branchId) {
    throw new AuthorizationError("You do not have permission to access this service");
  }
  return row;
}

const SERVICE_SELECT: Prisma.ServiceSelect = {
  id: true,
  branchId: true,
  departmentId: true,
  categoryId: true,
  serviceCode: true,
  name: true,
  description: true,
  price: true,
  taxPercent: true,
  discountAllowed: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true, code: true } },
  category: { select: { id: true, name: true } },
};

export async function listServices(actor: AuthUser, query: ListServicesQuery) {
  const { page, limit, search, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);
  const branchId = actor.branchId;

  const where: Prisma.ServiceWhereInput = { branchId };
  if (query.status) where.status = query.status;
  if (query.departmentId && Number.isInteger(Number(query.departmentId))) {
    where.departmentId = Number(query.departmentId);
  }
  if (query.categoryId && Number.isInteger(Number(query.categoryId))) {
    where.categoryId = Number(query.categoryId);
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { serviceCode: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.service.count({ where }),
    prisma.service.findMany({
      where,
      select: SERVICE_SELECT,
      orderBy: { [sortBy as SortableField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getService(actor: AuthUser, id: number) {
  await getAccessibleService(actor, id);
  return prisma.service.findUnique({ where: { id }, select: SERVICE_SELECT });
}

export async function createService(actor: AuthUser, input: CreateServiceInput) {
  await ensureBranch(actor.branchId);

  const existing = await prisma.service.findFirst({
    where: { branchId: actor.branchId, serviceCode: input.serviceCode },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(`Service code "${input.serviceCode}" already exists in this branch`);
  }

  const row = await prisma.service.create({
    data: {
      branchId: actor.branchId,
      departmentId: input.departmentId ?? null,
      categoryId: input.categoryId ?? null,
      serviceCode: input.serviceCode,
      name: input.name,
      description: input.description,
      price: input.price,
      taxPercent: input.taxPercent ?? "0",
      discountAllowed: input.discountAllowed ?? true,
      status: input.status ?? "active",
    },
  });

  await writeAuditLog({
    module: "service",
    action: "create",
    tableName: "Service",
    recordId: String(row.id),
    newValues: { name: row.name, serviceCode: row.serviceCode, branchId: actor.branchId },
    user: actor,
    branchId: actor.branchId,
  });

  return row;
}

export async function updateService(actor: AuthUser, id: number, input: UpdateServiceInput) {
  const accessible = await getAccessibleService(actor, id);
  const current = await prisma.service.findUnique({ where: { id } });
  const updated = await prisma.service.update({
    where: { id },
    data: { ...input },
  });

  await writeAuditLog({
    module: "service",
    action: "update",
    tableName: "Service",
    recordId: String(id),
    oldValues: { name: current?.name, serviceCode: current?.serviceCode },
    newValues: { ...input },
    user: actor,
    branchId: accessible.branchId,
  });

  return updated;
}

export async function listServiceCategories() {
  return prisma.serviceCategory.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true },
  });
}