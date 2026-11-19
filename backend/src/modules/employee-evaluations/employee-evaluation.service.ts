import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthorizationError, NotFoundError, ValidationError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type {
  CreateEmployeeEvaluationInput,
  ListEmployeeEvaluationsQuery,
  UpdateEmployeeEvaluationInput,
} from "./employee-evaluation.validation";

const EVALUATION_SELECT: Prisma.EmployeeEvaluationSelect = {
  id: true,
  branchId: true,
  employeeId: true,
  evaluatorId: true,
  date: true,
  rating: true,
  comments: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  employee: { select: { id: true, name: true, employeeCode: true } },
  evaluator: { select: { id: true, name: true } },
};

function isSuperAdmin(actor: AuthUser) {
  return actor.roles.some((role) => role.seederKey === "SUPER_ADMIN");
}

function ensureBranch(actor: AuthUser, branchId: number) {
  if (actor.branchId !== branchId && !isSuperAdmin(actor)) {
    throw new AuthorizationError("You do not have permission to access this evaluation");
  }
}

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

export async function listEmployeeEvaluations(actor: AuthUser, query: ListEmployeeEvaluationsQuery) {
  const { page, limit } = parsePagination(query as Record<string, unknown>);
  const branchId = actor.branchId;
  const where: Prisma.EmployeeEvaluationWhereInput = { branchId };
  if (query.employeeId) where.employeeId = query.employeeId;
  const dateRange = dayRange(query.from, query.to);
  if (dateRange) where.date = dateRange;

  const [total, rows] = await Promise.all([
    prisma.employeeEvaluation.count({ where }),
    prisma.employeeEvaluation.findMany({
      where,
      select: EVALUATION_SELECT,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getEmployeeEvaluation(actor: AuthUser, id: number) {
  const row = await prisma.employeeEvaluation.findFirst({
    where: { id },
    select: EVALUATION_SELECT,
  });
  if (!row) throw new NotFoundError("Evaluation not found");
  ensureBranch(actor, row.branchId);
  return row;
}

export async function createEmployeeEvaluation(actor: AuthUser, input: CreateEmployeeEvaluationInput) {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, branchId: actor.branchId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!employee) throw new NotFoundError("Employee not found");

  const row = await prisma.employeeEvaluation.create({
    data: {
      branchId: actor.branchId,
      employeeId: input.employeeId,
      evaluatorId: actor.id,
      date: new Date(input.date),
      rating: input.rating ?? 0,
      comments: input.comments ?? null,
      status: input.status ?? "active",
    },
    select: EVALUATION_SELECT,
  });

  await writeAuditLog({
    module: "employeeEvaluation",
    action: "create",
    tableName: "EmployeeEvaluation",
    recordId: String(row.id),
    newValues: { employeeId: input.employeeId, rating: input.rating, date: input.date },
    user: actor,
    branchId: actor.branchId,
  });

  return row;
}

export async function updateEmployeeEvaluation(actor: AuthUser, id: number, input: UpdateEmployeeEvaluationInput) {
  const existing = await prisma.employeeEvaluation.findFirst({ where: { id }, select: { id: true, branchId: true } });
  if (!existing) throw new NotFoundError("Evaluation not found");
  ensureBranch(actor, existing.branchId);

  const row = await prisma.employeeEvaluation.update({
    where: { id },
    data: {
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.comments !== undefined ? { comments: input.comments ?? null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    select: EVALUATION_SELECT,
  });

  await writeAuditLog({
    module: "employeeEvaluation",
    action: "update",
    tableName: "EmployeeEvaluation",
    recordId: String(id),
    newValues: input as Prisma.InputJsonValue,
    user: actor,
    branchId: existing.branchId,
  });

  return row;
}

export async function deleteEmployeeEvaluation(actor: AuthUser, id: number) {
  const existing = await prisma.employeeEvaluation.findFirst({ where: { id }, select: { id: true, branchId: true } });
  if (!existing) throw new NotFoundError("Evaluation not found");
  ensureBranch(actor, existing.branchId);
  await prisma.employeeEvaluation.delete({ where: { id } });
  await writeAuditLog({
    module: "employeeEvaluation",
    action: "delete",
    tableName: "EmployeeEvaluation",
    recordId: String(id),
    user: actor,
    branchId: existing.branchId,
  });
}
