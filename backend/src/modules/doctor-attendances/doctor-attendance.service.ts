import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthorizationError, ConflictError, NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { parsePagination, buildPaginationMeta, type SortableField } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type {
  BulkDoctorAttendanceInput,
  CreateDoctorAttendanceInput,
  ListDoctorAttendancesQuery,
  UpdateDoctorAttendanceInput,
} from "./doctor-attendance.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

function resolveBranchId(actor: AuthUser): number {
  return actor.branchId;
}

async function getAccessibleDoctor(actor: AuthUser, doctorId: number) {
  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId }, select: { id: true, branchId: true, name: true } });
  if (!doctor) throw new NotFoundError("Doctor not found");
  if (!isSuperAdmin(actor) && actor.branchId !== doctor.branchId) {
    throw new AuthorizationError("You do not have permission to access this doctor");
  }
  return doctor;
}

async function getAccessibleAttendance(actor: AuthUser, id: number) {
  const row = await prisma.doctorAttendance.findFirst({ where: { id }, select: { id: true, branchId: true, doctorId: true } });
  if (!row) throw new NotFoundError("Attendance record not found");
  if (!isSuperAdmin(actor) && actor.branchId !== row.branchId) {
    throw new AuthorizationError("You do not have permission to access this record");
  }
  return row;
}

const ATTENDANCE_SELECT: Prisma.DoctorAttendanceSelect = {
  id: true,
  branchId: true,
  doctorId: true,
  date: true,
  status: true,
  checkInTime: true,
  checkOutTime: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  doctor: { select: { id: true, name: true, doctorCode: true } },
};

function toDate(value: string): Date {
  // Date-only, interpreted in local time (matches how the browser renders dates).
  return new Date(`${value}T00:00:00`);
}

export async function listDoctorAttendances(actor: AuthUser, query: ListDoctorAttendancesQuery) {
  const { page, limit } = parsePagination(query as Record<string, unknown>);
  const branchId = resolveBranchId(actor);

  const where: Prisma.DoctorAttendanceWhereInput = { branchId };
  if (query.doctorId) where.doctorId = query.doctorId;
  if (query.status) where.status = query.status;
  if (query.date) where.date = toDate(query.date);
  if (query.from || query.to) {
    where.date = {
      ...(query.from ? { gte: toDate(query.from) } : {}),
      ...(query.to ? { lte: toDate(query.to) } : {}),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.doctorAttendance.count({ where }),
    prisma.doctorAttendance.findMany({
      where,
      select: ATTENDANCE_SELECT,
      orderBy: [{ date: "desc" }, { doctorId: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getDoctorAttendance(actor: AuthUser, id: number) {
  await getAccessibleAttendance(actor, id);
  return prisma.doctorAttendance.findUnique({ where: { id }, select: ATTENDANCE_SELECT });
}

export async function createDoctorAttendance(actor: AuthUser, input: CreateDoctorAttendanceInput) {
  const doctor = await getAccessibleDoctor(actor, input.doctorId);
  const branchId = doctor.branchId;
  const date = toDate(input.date);

  const existing = await prisma.doctorAttendance.findFirst({
    where: { branchId, doctorId: input.doctorId, date },
    select: { id: true },
  });
  if (existing) throw new ConflictError("Attendance already recorded for this doctor on that date");

  const row = await prisma.doctorAttendance.create({
    data: {
      branchId,
      doctorId: input.doctorId,
      date,
      status: input.status ?? "PRESENT",
      checkInTime: input.checkInTime ?? null,
      checkOutTime: input.checkOutTime ?? null,
      notes: input.notes ?? null,
    },
    select: ATTENDANCE_SELECT,
  });

  await writeAuditLog({
    module: "doctorAttendance",
    action: "create",
    tableName: "DoctorAttendance",
    recordId: String(row.id),
    newValues: { doctorId: row.doctorId, date: input.date, status: row.status },
    user: actor,
    branchId,
  });

  return row;
}

export async function updateDoctorAttendance(actor: AuthUser, id: number, input: UpdateDoctorAttendanceInput) {
  const access = await getAccessibleAttendance(actor, id);
  const updated = await prisma.doctorAttendance.update({
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
    module: "doctorAttendance",
    action: "update",
    tableName: "DoctorAttendance",
    recordId: String(id),
    newValues: { ...input },
    user: actor,
    branchId: access.branchId,
  });

  return updated;
}

export async function deleteDoctorAttendance(actor: AuthUser, id: number) {
  const access = await getAccessibleAttendance(actor, id);
  await prisma.doctorAttendance.delete({ where: { id } });

  await writeAuditLog({
    module: "doctorAttendance",
    action: "delete",
    tableName: "DoctorAttendance",
    recordId: String(id),
    user: actor,
    branchId: access.branchId,
  });
}

export async function bulkDoctorAttendance(actor: AuthUser, input: BulkDoctorAttendanceInput) {
  const branchId = resolveBranchId(actor);
  const date = toDate(input.date);

  const results = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const entry of input.entries) {
      const doctor = await tx.doctor.findFirst({ where: { id: entry.doctorId }, select: { id: true, branchId: true } });
      if (!doctor || doctor.branchId !== branchId) continue;

      const existing = await tx.doctorAttendance.findFirst({
        where: { branchId, doctorId: entry.doctorId, date },
        select: { id: true },
      });

      if (existing) {
        const updated = await tx.doctorAttendance.update({
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
        const created = await tx.doctorAttendance.create({
          data: {
            branchId,
            doctorId: entry.doctorId,
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
    module: "doctorAttendance",
    action: "bulk",
    tableName: "DoctorAttendance",
    recordId: input.date,
    newValues: { count: results.length },
    user: actor,
    branchId,
  });

  return results;
}

export async function getAttendanceForDate(actor: AuthUser, date: string) {
  const branchId = resolveBranchId(actor);
  const d = toDate(date);
  const doctors = await prisma.doctor.findMany({
    where: { branchId, deletedAt: null, status: "active" },
    select: { id: true, name: true, doctorCode: true },
    orderBy: { name: "asc" },
  });
  const records = await prisma.doctorAttendance.findMany({
    where: { branchId, date: d },
    select: ATTENDANCE_SELECT,
  });
  const byDoctor = new Map(records.map((r) => [r.doctorId, r]));
  return doctors.map((doc) => ({
    doctor: doc,
    attendance: byDoctor.get(doc.id) ?? null,
  }));
}
