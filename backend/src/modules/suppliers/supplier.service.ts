import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { parsePagination, buildPaginationMeta } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type {
  CreateSupplierInput,
  ListSuppliersQuery,
  UpdateSupplierInput,
} from "./supplier.validation";

const SUPPLIER_SELECT: Prisma.SupplierSelect = {
  id: true,
  name: true,
  mobile: true,
  address: true,
  balance: true,
  status: true,
  shop: true,
  createdAt: true,
  updatedAt: true,
};

const SUPPLIER_SORTABLE = ["id", "name", "mobile", "status", "shop", "createdAt", "updatedAt"] as const;

/** The imported table uses tinyint 1/0; the API speaks active/inactive. */
function statusToInt(status: CreateSupplierInput["status"]): number {
  return status === "inactive" ? 0 : 1;
}

function toRecord(row: {
  id: bigint;
  name: string;
  mobile: string | null;
  address: string | null;
  balance: number | null;
  status: number;
  shop: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}) {
  return {
    ...row,
    id: Number(row.id),
    status: row.status === 1 ? ("active" as const) : ("inactive" as const),
  };
}

export async function listSuppliers(query: ListSuppliersQuery) {
  const { page, limit, search } = parsePagination(query as Record<string, unknown>);

  const where: Prisma.SupplierWhereInput = {};
  if (query.status) where.status = statusToInt(query.status);
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { mobile: { contains: search } },
      { address: { contains: search } },
    ];
  }

  const sortBy =
    typeof query.sortBy === "string" && SUPPLIER_SORTABLE.includes(query.sortBy as (typeof SUPPLIER_SORTABLE)[number])
      ? query.sortBy
      : null;
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
  const orderBy: Prisma.SupplierOrderByWithRelationInput = sortBy
    ? ({ [sortBy]: sortOrder } as Prisma.SupplierOrderByWithRelationInput)
    : { name: "asc" };

  const [total, rows] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      select: SUPPLIER_SELECT,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: rows.map(toRecord),
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export async function getSupplier(id: number) {
  const row = await prisma.supplier.findUnique({
    where: { id: BigInt(id) },
    select: SUPPLIER_SELECT,
  });
  if (!row) throw new NotFoundError("Supplier not found");
  return toRecord(row);
}

export async function createSupplier(actor: AuthUser, input: CreateSupplierInput) {
  const now = new Date();
  const row = await prisma.supplier.create({
    data: {
      name: input.name,
      mobile: input.mobile ?? null,
      address: input.address ?? null,
      balance: input.balance ?? null,
      status: statusToInt(input.status),
      shop: input.shop ?? 3,
      createdAt: now,
      updatedAt: now,
    },
    select: SUPPLIER_SELECT,
  });

  const record = toRecord(row);
  await writeAuditLog({
    module: "supplier",
    action: "create",
    tableName: "suppliers",
    recordId: String(record.id),
    user: actor,
    branchId: actor.branchId,
    newValues: record,
  });
  return record;
}

export async function updateSupplier(actor: AuthUser, id: number, input: UpdateSupplierInput) {
  const before = await getSupplier(id);
  const data: Prisma.SupplierUpdateInput = { updatedAt: new Date() };
  if (input.name !== undefined) data.name = input.name;
  if (input.mobile !== undefined) data.mobile = input.mobile ?? null;
  if (input.address !== undefined) data.address = input.address ?? null;
  if (input.balance !== undefined) data.balance = input.balance ?? null;
  if (input.status !== undefined) data.status = statusToInt(input.status);
  if (input.shop !== undefined) data.shop = input.shop;

  const row = await prisma.supplier.update({
    where: { id: BigInt(id) },
    data,
    select: SUPPLIER_SELECT,
  });

  const record = toRecord(row);
  await writeAuditLog({
    module: "supplier",
    action: "update",
    tableName: "suppliers",
    recordId: String(record.id),
    user: actor,
    branchId: actor.branchId,
    oldValues: before,
    newValues: record,
  });
  return record;
}

export async function deleteSupplier(actor: AuthUser, id: number) {
  const before = await getSupplier(id);
  await prisma.supplier.delete({ where: { id: BigInt(id) }, select: { id: true } });
  await writeAuditLog({
    module: "supplier",
    action: "delete",
    tableName: "suppliers",
    recordId: String(id),
    user: actor,
    branchId: actor.branchId,
    oldValues: before,
  });
  return { id, name: before.name };
}
