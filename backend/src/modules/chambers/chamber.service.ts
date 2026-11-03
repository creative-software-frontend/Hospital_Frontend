import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthorizationError, ConflictError, NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { generateBusinessCode, CODE_ENTITIES } from "../../utils/codeGenerator";
import { parsePagination, buildPaginationMeta, type SortableField } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type { CreateChamberInput, ListChambersQuery, ReplaceChamberScheduleInput, UpdateChamberInput } from "./chamber.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

function resolveBranchId(actor: AuthUser): number {
  return actor.branchId;
}

async function ensureBranch(id: number): Promise<void> {
  const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
  if (!branch) throw new NotFoundError("Branch not found");
}

async function getAccessibleChamber(actor: AuthUser, id: number) {
  const row = await prisma.chamber.findFirst({ where: { id }, select: { id: true, branchId: true } });
  if (!row) throw new NotFoundError("Chamber not found");
  if (!isSuperAdmin(actor) && actor.branchId !== row.branchId) {
    throw new AuthorizationError("You do not have permission to access this chamber");
  }
  return row;
}

async function ensureDoctor(actor: AuthUser, doctorId: number | null | undefined, branchId: number) {
  if (doctorId == null) return;
  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId }, select: { id: true, branchId: true } });
  if (!doctor) throw new NotFoundError("Doctor not found");
  if (doctor.branchId !== branchId) {
    throw new AuthorizationError("Doctor does not belong to this branch");
  }
}

const CHAMBER_SELECT: Prisma.ChamberSelect = {
  id: true,
  branchId: true,
  name: true,
  code: true,
  location: true,
  description: true,
  doctorId: true,
  status: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true, code: true, city: true } },
  doctor: { select: { id: true, name: true, doctorCode: true } },
  _count: { select: { schedules: true } },
};

const CHAMBER_SCHEDULE_SELECT: Prisma.ChamberScheduleSelect = {
  id: true,
  chamberId: true,
  branchId: true,
  doctorId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  status: true,
  doctor: { select: { id: true, name: true, doctorCode: true } },
};

export async function listChambers(actor: AuthUser, query: ListChambersQuery) {
  const { page, limit, search, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);
  const branchId = resolveBranchId(actor);

  const where: Prisma.ChamberWhereInput = { branchId, deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.doctorId) where.doctorId = query.doctorId;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
      { location: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.chamber.count({ where }),
    prisma.chamber.findMany({
      where,
      select: CHAMBER_SELECT,
      orderBy: { [sortBy as SortableField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getChamber(actor: AuthUser, id: number) {
  await getAccessibleChamber(actor, id);
  return prisma.chamber.findUnique({ where: { id }, select: CHAMBER_SELECT });
}

export async function createChamber(actor: AuthUser, input: CreateChamberInput) {
  const branchId = input.branchId ?? resolveBranchId(actor);
  if (!isSuperAdmin(actor) && branchId !== actor.branchId) {
    throw new AuthorizationError("You do not have permission to create a chamber in this branch");
  }
  await ensureBranch(branchId);
  await ensureDoctor(actor, input.doctorId ?? null, branchId);

  let code = input.code?.trim();
  if (!code) {
    code = await prisma.$transaction(async (tx) =>
      generateBusinessCode(tx, CODE_ENTITIES.CHAMBER, branchId, { prefix: "CH", padding: 6 }),
    );
  }

  const existing = await prisma.chamber.findFirst({
    where: { branchId, code },
    select: { id: true },
  });
  if (existing) throw new ConflictError(`Chamber code "${code}" already exists in this branch`);

  const row = await prisma.chamber.create({
    data: {
      branchId,
      name: input.name,
      code,
      location: input.location ?? null,
      description: input.description,
      doctorId: input.doctorId ?? null,
      status: input.status ?? "active",
    },
    select: CHAMBER_SELECT,
  });

  await writeAuditLog({
    module: "chamber",
    action: "create",
    tableName: "Chamber",
    recordId: String(row.id),
    newValues: { name: row.name, code: row.code, branchId },
    user: actor,
    branchId,
  });

  return row;
}

export async function updateChamber(actor: AuthUser, id: number, input: UpdateChamberInput) {
  const access = await getAccessibleChamber(actor, id);
  if (input.doctorId !== undefined) {
    await ensureDoctor(actor, input.doctorId, access.branchId);
  }

  const updated = await prisma.chamber.update({
    where: { id },
    data: { ...input },
    select: CHAMBER_SELECT,
  });

  await writeAuditLog({
    module: "chamber",
    action: "update",
    tableName: "Chamber",
    recordId: String(id),
    newValues: { ...input },
    user: actor,
    branchId: access.branchId,
  });

  return updated;
}

export async function deleteChamber(actor: AuthUser, id: number) {
  const access = await getAccessibleChamber(actor, id);
  await prisma.chamber.update({ where: { id }, data: { deletedAt: new Date(), status: "inactive" } });

  await writeAuditLog({
    module: "chamber",
    action: "delete",
    tableName: "Chamber",
    recordId: String(id),
    user: actor,
    branchId: access.branchId,
  });
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function overlaps(start: string, end: string, otherStart: string, otherEnd: string): boolean {
  return timeToMinutes(start) < timeToMinutes(otherEnd) && timeToMinutes(otherStart) < timeToMinutes(end);
}

export async function listChamberSchedules(actor: AuthUser, chamberId: number) {
  const chamber = await getAccessibleChamber(actor, chamberId);
  return prisma.chamberSchedule.findMany({
    where: { chamberId, branchId: chamber.branchId, status: "active" },
    select: CHAMBER_SCHEDULE_SELECT,
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
}

export async function replaceChamberSchedules(
  actor: AuthUser,
  chamberId: number,
  input: ReplaceChamberScheduleInput,
) {
  const chamber = await getAccessibleChamber(actor, chamberId);
  const doctorIds = [...new Set(input.slots.map((slot) => slot.doctorId))];
  const doctors = await prisma.doctor.findMany({
    where: { id: { in: doctorIds }, branchId: chamber.branchId, deletedAt: null },
    select: { id: true },
  });
  if (doctors.length !== doctorIds.length) {
    throw new NotFoundError("One or more doctors were not found in this branch");
  }

  for (const slot of input.slots) {
    if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) {
      throw new ConflictError("Each chamber slot must end after it starts");
    }
  }

  for (let index = 0; index < input.slots.length; index += 1) {
    const slot = input.slots[index];
    for (let otherIndex = index + 1; otherIndex < input.slots.length; otherIndex += 1) {
      const other = input.slots[otherIndex];
      if (
        slot.dayOfWeek === other.dayOfWeek &&
        overlaps(slot.startTime, slot.endTime, other.startTime, other.endTime)
      ) {
        throw new ConflictError("Chamber doctors cannot have overlapping slots on the same day");
      }
    }
  }
  const duplicateDoctorDay = input.slots.some((slot, index) =>
    input.slots.slice(index + 1).some((other) =>
      slot.doctorId === other.doctorId && slot.dayOfWeek === other.dayOfWeek,
    ),
  );
  if (duplicateDoctorDay) {
    throw new ConflictError("A doctor can have only one slot per day in this chamber");
  }

  const existing = await prisma.chamberSchedule.findMany({
    where: { branchId: chamber.branchId, status: "active", chamberId: { not: chamberId } },
    select: { doctorId: true, dayOfWeek: true, startTime: true, endTime: true },
  });
  for (const slot of input.slots) {
    if (existing.some((other) =>
      other.doctorId === slot.doctorId &&
      other.dayOfWeek === slot.dayOfWeek &&
      overlaps(slot.startTime, slot.endTime, other.startTime, other.endTime),
    )) {
      throw new ConflictError("This doctor already has an overlapping slot in another chamber");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.chamberSchedule.deleteMany({ where: { chamberId, branchId: chamber.branchId } });
    if (input.slots.length > 0) {
      await tx.chamberSchedule.createMany({
        data: input.slots.map((slot) => ({
          chamberId,
          branchId: chamber.branchId,
          doctorId: slot.doctorId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      });
    }
  });

  return listChamberSchedules(actor, chamberId);
}
