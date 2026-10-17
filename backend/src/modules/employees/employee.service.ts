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
import {
  CODE_ENTITIES,
  formatBusinessCode,
  generateBusinessCode,
  peekNextCodeNumber,
} from "../../utils/codeGenerator";
import { parsePagination, buildPaginationMeta, type SortableField } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type {
  CreateEmployeeInput,
  ListEmployeesQuery,
  UpdateEmployeeInput,
} from "./employee.validation";

// Mirrors the prefix baked into `codeGenerator.ENTITY_PREFIX` so the previewed
// id and the id actually issued at create time can never disagree.
const EMPLOYEE_CODE_PREFIX = "EMP";
const EMPLOYEE_CODE_PADDING = 6;

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

async function ensureBranch(id: number): Promise<void> {
  const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
  if (!branch) {
    throw new NotFoundError("Branch not found");
  }
}

// Reference lookups run before the write so a stale dropdown selection surfaces
// as a readable 404 instead of a raw FOREIGN_KEY_VIOLATION.
async function ensureReferences(input: {
  departmentId?: number | null;
  designationId?: number | null;
  employeeTypeId?: number | null;
}): Promise<void> {
  if (input.departmentId !== null && input.departmentId !== undefined) {
    const department = await prisma.department.findUnique({
      where: { id: input.departmentId },
      select: { id: true },
    });
    if (!department) throw new NotFoundError("Department not found");
  }
  if (input.designationId !== null && input.designationId !== undefined) {
    const designation = await prisma.designation.findUnique({
      where: { id: input.designationId },
      select: { id: true },
    });
    if (!designation) throw new NotFoundError("Designation not found");
  }
  if (input.employeeTypeId !== null && input.employeeTypeId !== undefined) {
    const employeeType = await prisma.employeeType.findUnique({
      where: { id: input.employeeTypeId },
      select: { id: true },
    });
    if (!employeeType) throw new NotFoundError("Employee type not found");
  }
}

function usernameSeed(email: string): string {
  const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  return local.length >= 3 ? local : `employee_${local}`;
}

// Derive a stable username from the employee email, disambiguating with a
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

async function getAccessibleEmployee(actor: AuthUser, id: number) {
  const row = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, branchId: true },
  });
  if (!row) {
    throw new NotFoundError("Employee not found");
  }
  if (!isSuperAdmin(actor) && actor.branchId !== row.branchId) {
    throw new AuthorizationError("You do not have permission to access this employee");
  }
  return row;
}

const EMPLOYEE_SELECT: Prisma.EmployeeSelect = {
  id: true,
  userId: true,
  branchId: true,
  employeeTypeId: true,
  designationId: true,
  departmentId: true,
  name: true,
  employeeCode: true,
  phone: true,
  email: true,
  gender: true,
  dateOfBirth: true,
  maritalStatus: true,
  bloodGroup: true,
  photo: true,
  permanentAddress: true,
  presentAddress: true,
  hireDate: true,
  basicSalary: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true, code: true } },
  designation: { select: { id: true, name: true } },
  employeeType: { select: { id: true, name: true } },
};

export async function listEmployees(actor: AuthUser, query: ListEmployeesQuery) {
  const { page, limit, search, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);
  const branchId = actor.branchId;

  const where: Prisma.EmployeeWhereInput = { branchId, deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.departmentId && Number.isInteger(Number(query.departmentId))) {
    where.departmentId = Number(query.departmentId);
  }
  if (query.designationId && Number.isInteger(Number(query.designationId))) {
    where.designationId = Number(query.designationId);
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { employeeCode: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      select: EMPLOYEE_SELECT,
      orderBy: { [sortBy as SortableField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: rows, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getEmployee(actor: AuthUser, id: number) {
  await getAccessibleEmployee(actor, id);
  return prisma.employee.findFirst({ where: { id, deletedAt: null }, select: EMPLOYEE_SELECT });
}

/**
 * Reference dropdowns for the employee form (employee types + designations).
 * Departments are served by the existing /departments endpoint.
 */
export async function listEmployeeReferences() {
  const [employeeTypes, designations] = await Promise.all([
    prisma.employeeType.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.designation.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { employeeTypes, designations };
}

/**
 * Previews the Emp ID the create form will receive. Reads the sequence without
 * claiming it, so repeatedly opening the form does not burn numbers.
 */
export async function peekNextEmployeeCode(actor: AuthUser): Promise<string> {
  const sequence = await prisma.$transaction((tx) =>
    peekNextCodeNumber(tx, CODE_ENTITIES.EMPLOYEE, actor.branchId),
  );
  return formatBusinessCode(EMPLOYEE_CODE_PREFIX, sequence, EMPLOYEE_CODE_PADDING);
}

export async function createEmployee(actor: AuthUser, input: CreateEmployeeInput) {
  await ensureBranch(actor.branchId);
  await ensureReferences(input);

  // An employee always ships with its linked login account, so a password is
  // mandatory. All plain-text handling and the fallible lookups below live
  // outside the write transaction so the code claim stays a single atomic unit.
  const password = input.password ?? "";
  if (!password) {
    throw new BusinessRuleError("Password is required to create an employee account");
  }
  await assertPasswordAcceptable(password);
  if (!input.email) {
    throw new BusinessRuleError("Email is required to create a login account");
  }
  const email = input.email;
  const role = await prisma.role.findUnique({ where: { seederKey: "EMPLOYEE" } });
  if (!role) {
    throw new BusinessRuleError("Employee role is not configured");
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new ConflictError("A user with this email already exists");
  }
  const username = await deriveUniqueUsername(email);
  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);

  // Claim the next branch-scoped employee code and create the record in one
  // transaction: if creation fails the sequence increment rolls back too.
  const row = await prisma.$transaction(async (tx) => {
    const employeeCode = await generateBusinessCode(
      tx,
      CODE_ENTITIES.EMPLOYEE,
      actor.branchId,
      { prefix: EMPLOYEE_CODE_PREFIX, padding: EMPLOYEE_CODE_PADDING },
    );
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
    return tx.employee.create({
      data: {
        branchId: actor.branchId,
        employeeCode,
        userId: user.id,
        name: input.name,
        departmentId: input.departmentId ?? null,
        designationId: input.designationId ?? null,
        employeeTypeId: input.employeeTypeId ?? null,
        hireDate: input.hireDate,
        basicSalary: input.basicSalary,
        gender: input.gender ?? null,
        dateOfBirth: input.dateOfBirth,
        maritalStatus: input.maritalStatus ?? null,
        bloodGroup: input.bloodGroup ?? null,
        photo: input.photo,
        phone: input.phone,
        email: input.email,
        permanentAddress: input.permanentAddress,
        presentAddress: input.presentAddress,
        status: input.status ?? "active",
      },
    });
  });

  await writeAuditLog({
    module: "employee",
    action: "create",
    tableName: "Employee",
    recordId: String(row.id),
    newValues: {
      name: row.name,
      employeeCode: row.employeeCode,
      branchId: actor.branchId,
      accountCreated: true,
      username,
    },
    user: actor,
    branchId: actor.branchId,
  });

  return row;
}

export async function updateEmployee(actor: AuthUser, id: number, input: UpdateEmployeeInput) {
  const accessible = await getAccessibleEmployee(actor, id);
  await ensureReferences(input);

  const current = await prisma.employee.findFirst({ where: { id } });
  const updated = await prisma.employee.update({
    where: { id },
    data: { ...input },
  });

  await writeAuditLog({
    module: "employee",
    action: "update",
    tableName: "Employee",
    recordId: String(id),
    oldValues: { name: current?.name, employeeCode: current?.employeeCode },
    newValues: { ...input },
    user: actor,
    branchId: accessible.branchId,
  });

  return updated;
}
