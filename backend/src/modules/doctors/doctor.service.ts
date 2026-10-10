import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { config } from "../../config";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { assertPasswordAcceptable } from "../auth/auth.service";
import { CODE_ENTITIES, generateBusinessCode } from "../../utils/codeGenerator";
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

// Check the department before writing. Without this a stale selection (for
// example a department deleted while the form was open) surfaces as a raw
// FOREIGN_KEY_VIOLATION, which tells the user nothing.
async function ensureDepartment(departmentId?: number | null): Promise<void> {
  if (departmentId === null || departmentId === undefined) return;
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true },
  });
  if (!department) {
    throw new NotFoundError("Department not found");
  }
}

function usernameSeed(email: string): string {
  const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  return local.length >= 3 ? local : `doctor_${local}`;
}

// Derive a stable username from the doctor email, disambiguating with a
// numeric suffix if a collision exists. The DB unique constraint is the final
// backstop against the tiny race between check and insert.
async function deriveUniqueUsername(email: string): Promise<string> {
  const base = usernameSeed(email);
  let candidate = base;
  let n = 2;
  while (await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } })) {
    const suffix = `_${n}`;
    candidate = `${base.slice(0, 63 - suffix.length)}${suffix}`;
    n += 1;
  }
  return candidate;
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
  await ensureDepartment(input.departmentId);

  // A doctor always ships with its linked login account, so a password is
  // mandatory. All plain-text handling and the fallible lookups below live
  // outside the write transaction so the code claim stays a single atomic unit.
  const password = input.password ?? "";
  if (!password) {
    throw new BusinessRuleError("Password is required to create a doctor account");
  }
  await assertPasswordAcceptable(password);
  if (!input.email) {
    throw new BusinessRuleError("Email is required to create a login account");
  }
  const email = input.email;
  const role = await prisma.role.findUnique({ where: { seederKey: "DOCTOR" } });
  if (!role) {
    throw new BusinessRuleError("Doctor role is not configured");
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new ConflictError("A user with this email already exists");
  }
  const username = await deriveUniqueUsername(email);
  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);

  // Claim the next branch-scoped doctor code and create the record in one
  // transaction: if creation fails the sequence increment rolls back too.
  const row = await prisma.$transaction(async (tx) => {
    const doctorCode = await generateBusinessCode(tx, CODE_ENTITIES.DOCTOR, actor.branchId);
    const user = await tx.user.create({
      data: {
        name: input.name,
        email,
        username,
        password: passwordHash,
        phone: input.phone,
        branchId: actor.branchId,
        status: "ACTIVE",
        // A brand-new account must not be treated as "password never changed".
        passwordChangedAt: new Date(),
        passwordHistory: [passwordHash],
      },
    });
    await tx.userRole.createMany({
      data: [{ userId: user.id, roleId: role.id }],
    });
    return tx.doctor.create({
      data: {
        branchId: actor.branchId,
        doctorCode,
        userId: user.id,
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
  });

  await writeAuditLog({
    module: "doctor",
    action: "create",
    tableName: "Doctor",
    recordId: String(row.id),
    newValues: {
      name: row.name,
      doctorCode: row.doctorCode,
      branchId: actor.branchId,
      accountCreated: true,
      username,
    },
    user: actor,
    branchId: actor.branchId,
  });

  return row;
}

export async function updateDoctor(actor: AuthUser, id: number, input: UpdateDoctorInput) {
  const accessible = await getAccessibleDoctor(actor, id);
  if (input.departmentId !== undefined) {
    await ensureDepartment(input.departmentId);
  }
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