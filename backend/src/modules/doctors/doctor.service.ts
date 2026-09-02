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
  CreateDoctorInput,
  ListDoctorsQuery,
  UpdateDoctorInput,
} from "./doctor.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

async function ensureBranch(id: number): Promise<void> {
  const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
  if (!branch) {
    throw new NotFoundError("Branch not found");
  }
}

async function getAccessibleDoctor(actor: AuthUser, id: number) {
  const row = await prisma.doctor.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!row) {
    throw new NotFoundError("Doctor not found");
  }
  if (!isSuperAdmin(actor) && actor.branchId !== row.branchId) {
    throw new AuthorizationError("You do not have permission to access this doctor");
  }
  return row;
}

const DOCTOR_SELECT: Prisma.DoctorSelect = {
  id: true,
  userId: true,
  branchId: true,
  departmentId: true,
  doctorCode: true,
  name: true,
  specialization: true,
  qualification: true,
  registrationNo: true,
  phone: true,
  email: true,
  consultationFee: true,
  followupFee: true,
  emergencyFee: true,
  commissionType: true,
  commissionValue: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true, code: true } },
};

export async function listDoctors(actor: AuthUser, query: ListDoctorsQuery) {
  const { page, limit, search, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);
  const branchId = actor.branchId;

  const where: Prisma.DoctorWhereInput = { branchId, deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.departmentId && Number.isInteger(Number(query.departmentId))) {
    where.departmentId = Number(query.departmentId);
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { doctorCode: { contains: search } },
      { specialization: { contains: search } },
      { registrationNo: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.doctor.count({ where }),
    prisma.doctor.findMany({
      where,
      select: DOCTOR_SELECT,
      orderBy: { [sortBy as SortableField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getDoctor(actor: AuthUser, id: number) {
  await getAccessibleDoctor(actor, id);
  return prisma.doctor.findFirst({ where: { id, deletedAt: null }, select: DOCTOR_SELECT });
}

export async function createDoctor(actor: AuthUser, input: CreateDoctorInput) {
  await ensureBranch(actor.branchId);

  const existing = await prisma.doctor.findFirst({
    where: { branchId: actor.branchId, doctorCode: input.doctorCode },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(`Doctor code "${input.doctorCode}" already exists in this branch`);
  }

  const row = await prisma.doctor.create({
    data: {
      branchId: actor.branchId,
      doctorCode: input.doctorCode,
      name: input.name,
      departmentId: input.departmentId ?? null,
      specialization: input.specialization,
      qualification: input.qualification,
      registrationNo: input.registrationNo,
      phone: input.phone,
      email: input.email,
      consultationFee: input.consultationFee,
      followupFee: input.followupFee,
      emergencyFee: input.emergencyFee,
      commissionType: input.commissionType ?? null,
      commissionValue: input.commissionValue,
      status: input.status ?? "active",
    },
  });

  await writeAuditLog({
    module: "doctor",
    action: "create",
    tableName: "Doctor",
    recordId: String(row.id),
    newValues: { name: row.name, doctorCode: row.doctorCode, branchId: actor.branchId },
    user: actor,
    branchId: actor.branchId,
  });

  return row;
}

export async function updateDoctor(actor: AuthUser, id: number, input: UpdateDoctorInput) {
  const accessible = await getAccessibleDoctor(actor, id);
  const current = await prisma.doctor.findFirst({ where: { id } });
  const updated = await prisma.doctor.update({
    where: { id },
    data: { ...input },
  });

  await writeAuditLog({
    module: "doctor",
    action: "update",
    tableName: "Doctor",
    recordId: String(id),
    oldValues: { name: current?.name, doctorCode: current?.doctorCode },
    newValues: { ...input },
    user: actor,
    branchId: accessible.branchId,
  });

  return updated;
}