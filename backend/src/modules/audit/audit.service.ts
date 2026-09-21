import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { parsePagination, buildPaginationMeta } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type { ListAuditQuery } from "./audit.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

function buildWhere(actor: AuthUser, query: ListAuditQuery): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  // Branch scoping mirrors the rest of the app: SUPER_ADMIN sees everything,
  // every other role is confined to their own branch.
  if (!isSuperAdmin(actor)) {
    where.branchId = actor.branchId;
  } else if (query.branchId) {
    where.branchId = query.branchId;
  }

  if (query.module) where.module = query.module;
  if (query.action) where.action = query.action;
  if (query.userId) where.userId = query.userId;

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  return where;
}

const AUDIT_SELECT = {
  id: true,
  userId: true,
  branchId: true,
  module: true,
  action: true,
  tableName: true,
  recordId: true,
  oldValues: true,
  newValues: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
  branch: { select: { id: true, name: true, code: true } },
} as const;

export async function listAuditLogs(actor: AuthUser, query: ListAuditQuery) {
  const { page, limit } = parsePagination(query as unknown as Record<string, unknown>);
  const where = buildWhere(actor, query);

  const [total, data] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      select: AUDIT_SELECT,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { id: "desc" },
    }),
  ]);

  return {
    data,
    pagination: buildPaginationMeta(page, limit, total),
  };
}

/** Export bound (rows) to keep generated files reasonable. */
const EXPORT_MAX_ROWS = 5000;

export async function exportAuditLogs(actor: AuthUser, query: ListAuditQuery) {
  const where = buildWhere(actor, query);
  return prisma.auditLog.findMany({
    where,
    select: AUDIT_SELECT,
    orderBy: { id: "desc" },
    take: EXPORT_MAX_ROWS,
  });
}