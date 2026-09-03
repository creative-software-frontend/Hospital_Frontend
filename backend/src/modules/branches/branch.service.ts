import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthorizationError, ConflictError, NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { parsePagination, buildPaginationMeta, type SortableField } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from "./branch.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

const BRANCH_LIST_SELECT: Prisma.BranchSelect = {
  id: true,
  name: true,
  code: true,
  registrationNo: true,
  address: true,
  city: true,
  district: true,
  country: true,
  phone: true,
  email: true,
  timezone: true,
  currency: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      users: true,
      departments: true,
      patients: true,
    },
  },
};

const BRANCH_DETAIL_SELECT: Prisma.BranchSelect = {
  ...BRANCH_LIST_SELECT,
  logo: true,
};

function buildListWhere(actor: AuthUser, query: ListBranchesQuery): Prisma.BranchWhereInput {
  const where: Prisma.BranchWhereInput = {};

  // Branch scoping: normal users may only ever see their own branch.
  if (!isSuperAdmin(actor)) {
    where.id = actor.branchId;
  }

  if (query.status) {
    where.status = query.status;
  }

  const search = query.search?.trim();
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
      { city: { contains: search } },
      { district: { contains: search } },
      { country: { contains: search } },
    ];
  }

  return where;
}

async function getAccessibleBranch(actor: AuthUser, id: number): Promise<{ id: number }> {
  const branch = await prisma.branch.findFirst({ where: { id }, select: { id: true } });
  if (!branch) {
    throw new NotFoundError("Branch not found");
  }
  if (!isSuperAdmin(actor) && actor.branchId !== id) {
    throw new AuthorizationError("You do not have permission to access this branch");
  }
  return branch;
}

export async function listBranches(actor: AuthUser, query: ListBranchesQuery) {
  const { page, limit, search, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);

  const where = buildListWhere(actor, { ...query, search });

  const [total, data] = await Promise.all([
    prisma.branch.count({ where }),
    prisma.branch.findMany({
      where,
      select: BRANCH_LIST_SELECT,
      orderBy: { [sortBy as SortableField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getBranch(actor: AuthUser, id: number) {
  await getAccessibleBranch(actor, id);
  const branch = await prisma.branch.findUnique({ where: { id }, select: BRANCH_DETAIL_SELECT });
  return branch!;
}

export async function createBranch(actor: AuthUser, input: CreateBranchInput) {
  if (!isSuperAdmin(actor)) {
    throw new AuthorizationError("Only a super admin can create a branch");
  }

  const code = input.code.toUpperCase();
  const existing = await prisma.branch.findUnique({ where: { code }, select: { id: true } });
  if (existing) {
    throw new ConflictError(`Branch code "${code}" already exists`);
  }

  const branch = await prisma.branch.create({
    data: {
      name: input.name,
      code,
      registrationNo: input.registrationNo,
      address: input.address,
      city: input.city,
      district: input.district,
      country: input.country,
      phone: input.phone,
      email: input.email,
      timezone: input.timezone,
      currency: input.currency,
      status: input.status ?? "active",
    },
    select: BRANCH_DETAIL_SELECT,
  });

  await writeAuditLog({
    module: "branch",
    action: "create",
    tableName: "Branch",
    recordId: String(branch.id),
    newValues: { name: branch.name, code: branch.code },
    user: actor,
  });

  return branch;
}

export async function updateBranch(actor: AuthUser, id: number, input: UpdateBranchInput) {
  await getAccessibleBranch(actor, id);

  const current = await prisma.branch.findUnique({ where: { id }, select: { name: true, code: true } });
  const updated = await prisma.branch.update({
    where: { id },
    data: { ...input },
    select: BRANCH_DETAIL_SELECT,
  });

  await writeAuditLog({
    module: "branch",
    action: "update",
    tableName: "Branch",
    recordId: String(id),
    oldValues: current,
    newValues: { ...input },
    user: actor,
  });

  return updated;
}