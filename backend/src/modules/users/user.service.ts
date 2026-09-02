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
import { parsePagination, buildPaginationMeta, type SortableField } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UpdateUserStatusInput,
} from "./user.validation";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  phone: true,
  status: true,
  branchId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true, code: true } },
  userRoles: { select: { role: { select: { id: true, seederKey: true, name: true } } } },
} as const;

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

/**
 * Branch access rule. A SUPER_ADMIN may work across branches; every other role
 * is confined to their own branch.
 */
function enforceBranchAccess(actor: AuthUser, targetBranchId: number): void {
  if (!isSuperAdmin(actor) && actor.branchId !== targetBranchId) {
    throw new AuthorizationError("You do not have permission to access this branch");
  }
}

export async function listUsers(actor: AuthUser, query: ListUsersQuery) {
  const { page, limit, search, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);

  const where: Record<string, unknown> = {};

  // Branch scoping
  if (isSuperAdmin(actor)) {
    if (query.branchId) where.branchId = query.branchId;
  } else {
    where.branchId = actor.branchId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (search) {
    // MySQL collation is already case-insensitive, so plain `contains`
    // is sufficient (the `mode: "insensitive"` option is not supported
    // on the MySQL connector).
    where.OR = [
      { username: { contains: search } },
      { email: { contains: search } },
      { name: { contains: search } },
    ];
  }

  if (query.role) {
    where.userRoles = { some: { role: { seederKey: query.role } } };
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy as SortableField]: sortOrder },
    }),
  ]);

  return {
    data: users,
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export async function getUser(actor: AuthUser, id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { ...USER_SELECT, userRoles: true },
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  enforceBranchAccess(actor, user.branchId);
  return user;
}

export async function createUser(actor: AuthUser, input: CreateUserInput): Promise<void> {
  // Branch rule: non-super-admin can only create in their own branch.
  const targetBranchId = input.branchId ?? actor.branchId;
  if (!isSuperAdmin(actor)) {
    if (input.branchId && input.branchId !== actor.branchId) {
      throw new AuthorizationError("You do not have permission to create a user in another branch");
    }
  }

  // Verify branch + roles exist
  const branch = await prisma.branch.findUnique({ where: { id: targetBranchId } });
  if (!branch) {
    throw new NotFoundError("Branch not found");
  }

  const roles = await prisma.role.findMany({
    where: { id: { in: input.roleIds } },
  });
  if (roles.length !== input.roleIds.length) {
    throw new BusinessRuleError("One or more roles do not exist");
  }

  // Uniqueness pre-checks (handled again by DB constraints for correctness)
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
  });
  if (existing) {
    if (existing.email === input.email) {
      throw new ConflictError("A user with this email already exists");
    }
    throw new ConflictError("A user with this username already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, config.bcryptSaltRounds);

  await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        username: input.username,
        password: passwordHash,
        phone: input.phone,
        branchId: targetBranchId,
        status: "ACTIVE",
      },
    });

    await tx.userRole.createMany({
      data: roles.map((r) => ({ userId: created.id, roleId: r.id })),
    });
  });

  await writeAuditLog({
    module: "USER",
    action: "USER_CREATED",
    tableName: "User",
    recordId: undefined,
    newValues: { name: input.name, email: input.email, username: input.username, branchId: targetBranchId, roleIds: input.roleIds },
    user: actor,
    branchId: targetBranchId,
  });
}

export async function updateUser(actor: AuthUser, id: number, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  enforceBranchAccess(actor, user.branchId);

  // If roles change, validate them first
  let rolesToAssign: { id: number }[] | undefined;
  if (input.roleIds) {
    const roles = await prisma.role.findMany({ where: { id: { in: input.roleIds } } });
    if (roles.length !== input.roleIds.length) {
      throw new BusinessRuleError("One or more roles do not exist");
    }
    rolesToAssign = roles;
  }

  // Uniqueness check if email/username changed
  if (input.email || input.username) {
    const existing = await prisma.user.findFirst({
      where: {
        id: { not: id },
        OR: [
          ...(input.email ? [{ email: input.email }] : []),
          ...(input.username ? [{ username: input.username }] : []),
        ],
      },
    });
    if (existing) {
      throw new ConflictError("Email or username is already in use");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        username: input.username,
        phone: input.phone,
      },
    });

    if (rolesToAssign) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: rolesToAssign.map((r) => ({ userId: id, roleId: r.id })),
      });
    }
  });

  await writeAuditLog({
    module: "USER",
    action: "USER_UPDATED",
    tableName: "User",
    recordId: String(id),
    newValues: input,
    user: actor,
    branchId: user.branchId,
  });

  return getUser(actor, id);
}

export async function updateUserStatus(
  actor: AuthUser,
  id: number,
  input: UpdateUserStatusInput,
) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { userRoles: { select: { role: { select: { seederKey: true } } } } },
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  enforceBranchAccess(actor, user.branchId);

  // Prevent a user from deactivating/suspending/locking themselves.
  if (actor.id === id && input.status !== "ACTIVE") {
    throw new BusinessRuleError("You cannot change your own active status");
  }

  const isTargetSuperAdmin = user.userRoles.some((ur) => ur.role.seederKey === "SUPER_ADMIN");
  if (isTargetSuperAdmin && input.status !== "ACTIVE") {
    const activeSuperAdmins = await prisma.user.count({
      where: { status: "ACTIVE", userRoles: { some: { role: { seederKey: "SUPER_ADMIN" } } } },
    });
    if (activeSuperAdmins <= 1) {
      throw new BusinessRuleError("Cannot deactivate the last active SUPER_ADMIN");
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status: input.status },
    select: USER_SELECT,
  });

  await writeAuditLog({
    module: "USER",
    action: "USER_STATUS_CHANGED",
    tableName: "User",
    recordId: String(id),
    oldValues: { status: user.status },
    newValues: { status: input.status },
    user: actor,
    branchId: user.branchId,
  });

  return updated;
}
