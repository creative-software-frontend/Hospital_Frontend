import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthorizationError, ConflictError, NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { parsePagination, buildPaginationMeta, type SortableField } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type {
  CreateDoctorScheduleInput,
  ListDoctorSchedulesQuery,
  ReplaceDoctorScheduleInput,
  UpdateDoctorScheduleInput,
} from "./doctor-schedule.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

function resolveBranchId(actor: AuthUser): number {
  return actor.branchId;
}

async function getAccessibleDoctor(actor: AuthUser, doctorId: number) {
  const doctor = await prisma.doctor.findFirst({
    where: { id: doctorId },
    select: { id: true, branchId: true, name: true },
  });
  if (!doctor) throw new NotFoundError("Doctor not found");
  if (!isSuperAdmin(actor) && actor.branchId !== doctor.branchId) {
    throw new AuthorizationError("You do not have permission to access this doctor");
  }
  return doctor;
}

async function getAccessibleSchedule(actor: AuthUser, id: number) {
  const row = await prisma.doctorSchedule.findFirst({
    where: { id },
    select: { id: true, branchId: true, doctorId: true },
  });
  if (!row) throw new NotFoundError("Doctor schedule not found");
  if (!isSuperAdmin(actor) && actor.branchId !== row.branchId) {
    throw new AuthorizationError("You do not have permission to access this schedule");
  }
  return row;
}

const SCHEDULE_SELECT: Prisma.DoctorScheduleSelect = {
  id: true,
  branchId: true,
  doctorId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  roomId: true,
  appointmentLimit: true,
  status: true,
  doctor: { select: { id: true, name: true, doctorCode: true } },
  room: { select: { id: true, name: true } },
};

export async function listDoctorSchedules(actor: AuthUser, query: ListDoctorSchedulesQuery) {
  const { page, limit } = parsePagination(query as Record<string, unknown>);
  const branchId = resolveBranchId(actor);

  const where: Prisma.DoctorScheduleWhereInput = { branchId };
  if (query.doctorId) where.doctorId = query.doctorId;

  const [total, rows] = await Promise.all([
    prisma.doctorSchedule.count({ where }),
    prisma.doctorSchedule.findMany({
      where,
      select: SCHEDULE_SELECT,
      orderBy: [{ doctorId: "asc" }, { dayOfWeek: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getDoctorSchedule(actor: AuthUser, id: number) {
  await getAccessibleSchedule(actor, id);
  return prisma.doctorSchedule.findUnique({ where: { id }, select: SCHEDULE_SELECT });
}

export async function createDoctorSchedule(actor: AuthUser, input: CreateDoctorScheduleInput) {
  const doctor = await getAccessibleDoctor(actor, input.doctorId);
  const branchId = doctor.branchId;

  const existing = await prisma.doctorSchedule.findFirst({
    where: { branchId, doctorId: input.doctorId, dayOfWeek: input.dayOfWeek },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("A schedule already exists for this doctor on that day");
  }

  const row = await prisma.doctorSchedule.create({
    data: {
      branchId,
      doctorId: input.doctorId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      roomId: input.roomId ?? null,
      appointmentLimit: input.appointmentLimit ?? 0,
      status: input.status ?? "active",
    },
    select: SCHEDULE_SELECT,
  });

  await writeAuditLog({
    module: "doctorSchedule",
    action: "create",
    tableName: "DoctorSchedule",
    recordId: String(row.id),
    newValues: { doctorId: row.doctorId, dayOfWeek: row.dayOfWeek, branchId },
    user: actor,
    branchId,
  });

  return row;
}

export async function updateDoctorSchedule(actor: AuthUser, id: number, input: UpdateDoctorScheduleInput) {
  const access = await getAccessibleSchedule(actor, id);
  const current = await prisma.doctorSchedule.findUnique({ where: { id } });

  const updated = await prisma.doctorSchedule.update({
    where: { id },
    data: {
      ...(input.dayOfWeek !== undefined ? { dayOfWeek: input.dayOfWeek } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),
      ...(input.appointmentLimit !== undefined ? { appointmentLimit: input.appointmentLimit } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    select: SCHEDULE_SELECT,
  });

  await writeAuditLog({
    module: "doctorSchedule",
    action: "update",
    tableName: "DoctorSchedule",
    recordId: String(id),
    oldValues: { dayOfWeek: current?.dayOfWeek, status: current?.status },
    newValues: { ...input },
    user: actor,
    branchId: access.branchId,
  });

  return updated;
}

export async function deleteDoctorSchedule(actor: AuthUser, id: number) {
  const access = await getAccessibleSchedule(actor, id);
  await prisma.doctorSchedule.delete({ where: { id } });

  await writeAuditLog({
    module: "doctorSchedule",
    action: "delete",
    tableName: "DoctorSchedule",
    recordId: String(id),
    user: actor,
    branchId: access.branchId,
  });
}

export async function getDoctorScheduleByDoctor(actor: AuthUser, doctorId: number) {
  const doctor = await getAccessibleDoctor(actor, doctorId);
  return prisma.doctorSchedule.findMany({
    where: { doctorId, branchId: doctor.branchId },
    select: SCHEDULE_SELECT,
    orderBy: { dayOfWeek: "asc" },
  });
}

export async function replaceDoctorSchedule(actor: AuthUser, doctorId: number, input: ReplaceDoctorScheduleInput) {
  const doctor = await getAccessibleDoctor(actor, doctorId);
  const branchId = doctor.branchId;

  await prisma.$transaction(async (tx) => {
    await tx.doctorSchedule.deleteMany({ where: { doctorId, branchId } });
    if (input.slots.length > 0) {
      await tx.doctorSchedule.createMany({
        data: input.slots.map((slot) => ({
          branchId,
          doctorId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime ?? null,
          endTime: slot.endTime ?? null,
          roomId: slot.roomId ?? null,
          appointmentLimit: slot.appointmentLimit ?? 0,
          status: slot.status ?? "active",
        })),
      });
    }
  });

  await writeAuditLog({
    module: "doctorSchedule",
    action: "replace",
    tableName: "DoctorSchedule",
    recordId: String(doctorId),
    newValues: { slotCount: input.slots.length },
    user: actor,
    branchId,
  });

  return prisma.doctorSchedule.findMany({
    where: { doctorId, branchId },
    select: SCHEDULE_SELECT,
    orderBy: { dayOfWeek: "asc" },
  });
}
