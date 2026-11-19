import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthorizationError, ConflictError, NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { parsePagination, buildPaginationMeta, type SortableField } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type {
  BulkEmployeeAttendanceInput,
  CreateEmployeeAttendanceInput,
  ListEmployeeAttendancesQuery,
  UpdateEmployeeAttendanceInput,
} from "./employee-attendance.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

function resolveBranchId(actor: AuthUser): number {
  return actor.branchId;
}

async function getAccessibleEmployee(actor: AuthUser, employeeId: number) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId }, select: { id: true, branchId: true, name: true } });
  if (!employee) throw new NotFoundError("Employee not found");
  if (!isSuperAdmin(actor) && actor.branchId !== employee.branchId) {
    throw new AuthorizationError("You do not have permission to access this employee");
  }
  return employee;
}

async function getAccessibleAttendance(actor: AuthUser, id: number) {
  const row = await prisma.employeeAttendance.findFirst({ where: { id }, select: { id: true, branchId: true, employeeId: true } });
  if (!row) throw new NotFoundError("Attendance record not found");
  if (!isSuperAdmin(actor) && actor.branchId !== row.branchId) {
    throw new AuthorizationError("You do not have permission to access this record");
  }
  return row;
}

const ATTENDANCE_SELECT: Prisma.EmployeeAttendanceSelect = {
  id: true,
  branchId: true,
  employeeId: true,
  date: true,
  status: true,
  checkInTime: true,
  checkOutTime: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  employee: { select: { id: true, name: true, employeeCode: true } },
};

function toDate(value: string): Date {
  // Date-only, interpreted in local time (matches how the browser renders dates).
  return new Date(`${value}T00:00:00`);
}

export async function listEmployeeAttendances(actor: AuthUser, query: ListEmployeeAttendancesQuery) {
  const { page, limit } = parsePagination(query as Record<string, unknown>);
  const branchId = resolveBranchId(actor);

  const where: Prisma.EmployeeAttendanceWhereInput = { branchId };
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.status) where.status = query.status;
  if (query.date) where.date = toDate(query.date);
  if (query.from || query.to) {
    where.date = {
      ...(query.from ? { gte: toDate(query.from) } : {}),
      ...(query.to ? { lte: toDate(query.to) } : {}),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.employeeAttendance.count({ where }),
    prisma.employeeAttendance.findMany({
      where,
      select: ATTENDANCE_SELECT,
      orderBy: [{ date: "desc" }, { employeeId: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getEmployeeAttendance(actor: AuthUser, id: number) {
  await getAccessibleAttendance(actor, id);
  return prisma.employeeAttendance.findUnique({ where: { id }, select: ATTENDANCE_SELECT });
}

export async function createEmployeeAttendance(actor: AuthUser, input: CreateEmployeeAttendanceInput) {
  const employee = await getAccessibleEmployee(actor, input.employeeId);
  const branchId = employee.branchId;
  const date = toDate(input.date);

  const existing = await prisma.employeeAttendance.findFirst({
    where: { branchId, employeeId: input.employeeId, date },
    select: { id: true },
  });
  if (existing) throw new ConflictError("Attendance already recorded for this employee on that date");

  const row = await prisma.employeeAttendance.create({
    data: {
      branchId,
      employeeId: input.employeeId,
      date,
      status: input.status ?? "PRESENT",
      checkInTime: input.checkInTime ?? null,
      checkOutTime: input.checkOutTime ?? null,
      notes: input.notes ?? null,
    },
    select: ATTENDANCE_SELECT,
  });

  await writeAuditLog({
    module: "employeeAttendance",
    action: "create",
    tableName: "EmployeeAttendance",
    recordId: String(row.id),
    newValues: { employeeId: row.employeeId, date: input.date, status: row.status },
    user: actor,
    branchId,
  });

  return row;
}

export async function updateEmployeeAttendance(actor: AuthUser, id: number, input: UpdateEmployeeAttendanceInput) {
  const access = await getAccessibleAttendance(actor, id);
  const updated = await prisma.employeeAttendance.update({
    where: { id },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.checkInTime !== undefined ? { checkInTime: input.checkInTime } : {}),
      ...(input.checkOutTime !== undefined ? { checkOutTime: input.checkOutTime } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    select: ATTENDANCE_SELECT,
  });

  await writeAuditLog({
    module: "employeeAttendance",
    action: "update",
    tableName: "EmployeeAttendance",
    recordId: String(id),
    newValues: { ...input },
    user: actor,
    branchId: access.branchId,
  });

  return updated;
}

export async function deleteEmployeeAttendance(actor: AuthUser, id: number) {
  const access = await getAccessibleAttendance(actor, id);
  await prisma.employeeAttendance.delete({ where: { id } });

  await writeAuditLog({
    module: "employeeAttendance",
    action: "delete",
    tableName: "EmployeeAttendance",
    recordId: String(id),
    user: actor,
    branchId: access.branchId,
  });
}

export async function bulkEmployeeAttendance(actor: AuthUser, input: BulkEmployeeAttendanceInput) {
  const branchId = resolveBranchId(actor);
  const date = toDate(input.date);

  const results = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const entry of input.entries) {
      const employee = await tx.employee.findFirst({ where: { id: entry.employeeId }, select: { id: true, branchId: true } });
      if (!employee || employee.branchId !== branchId) continue;

      const existing = await tx.employeeAttendance.findFirst({
        where: { branchId, employeeId: entry.employeeId, date },
        select: { id: true },
      });

      if (existing) {
        const updated = await tx.employeeAttendance.update({
          where: { id: existing.id },
          data: {
            status: entry.status,
            checkInTime: entry.checkInTime ?? null,
            checkOutTime: entry.checkOutTime ?? null,
            notes: entry.notes ?? null,
          },
          select: ATTENDANCE_SELECT,
        });
        out.push(updated);
      } else {
        const created = await tx.employeeAttendance.create({
          data: {
            branchId,
            employeeId: entry.employeeId,
            date,
            status: entry.status,
            checkInTime: entry.checkInTime ?? null,
            checkOutTime: entry.checkOutTime ?? null,
            notes: entry.notes ?? null,
          },
          select: ATTENDANCE_SELECT,
        });
        out.push(created);
      }
    }
    return out;
  });

  await writeAuditLog({
    module: "employeeAttendance",
    action: "bulk",
    tableName: "EmployeeAttendance",
    recordId: input.date,
    newValues: { count: results.length },
    user: actor,
    branchId,
  });

  return results;
}

export async function getEmployeeAttendanceForDate(actor: AuthUser, date: string) {
  const branchId = resolveBranchId(actor);
  const d = toDate(date);
  const employees = await prisma.employee.findMany({
    where: { branchId, deletedAt: null, status: "active" },
    select: { id: true, name: true, employeeCode: true },
    orderBy: { name: "asc" },
  });
  const records = await prisma.employeeAttendance.findMany({
    where: { branchId, date: d },
    select: ATTENDANCE_SELECT,
  });
  const byEmployee = new Map(records.map((r) => [r.employeeId, r]));
  return employees.map((emp) => ({
    employee: emp,
    attendance: byEmployee.get(emp.id) ?? null,
  }));
}
