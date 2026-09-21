import { prisma } from "../../lib/prisma";
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
} from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import type { AuthUser } from "../../types/auth";
import type { ListRolesQuery, UpdateRolePermissionsInput } from "./role.validation";

export async function listRoles(query: ListRolesQuery) {
  return prisma.role.findMany({
    where: query.status ? { status: query.status } : undefined,
    select: {
      id: true,
      seederKey: true,
      name: true,
      description: true,
      status: true,
      rolePermissions: {
        select: {
          permission: { select: { id: true, module: true, action: true, description: true } },
        },
        orderBy: { permission: { module: "asc" } },
      },
    },
    orderBy: { id: "asc" },
  });
}

export async function getRole(id: number) {
  const role = await prisma.role.findUnique({
    where: { id },
    select: {
      id: true,
      seederKey: true,
      name: true,
      description: true,
      status: true,
      rolePermissions: {
        select: {
          permission: { select: { id: true, module: true, action: true, description: true } },
        },
        orderBy: { permission: { module: "asc" } },
      },
    },
  });
  if (!role) {
    throw new NotFoundError("Role not found");
  }
  return role;
}

/**
 * Replaces the permission set granted to a role. SUPER_ADMIN only. Existing
 * permission assignment is diffed to keep the audit trail readable.
 */
export async function updateRolePermissions(
  actor: AuthUser,
  roleId: number,
  input: UpdateRolePermissionsInput,
) {
  if (!actor.roles.some((r) => r.seederKey === "SUPER_ADMIN")) {
    throw new AuthorizationError("SUPER_ADMIN role required");
  }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      rolePermissions: {
        select: { permissionId: true },
      },
    },
  });
  if (!role) {
    throw new NotFoundError("Role not found");
  }

  const uniqueIds = [...new Set(input.permissionIds)];
  const permissions = await prisma.permission.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  if (permissions.length !== uniqueIds.length) {
    throw new BusinessRuleError("One or more permissions do not exist");
  }

  const previousIds = role.rolePermissions.map((rp) => rp.permissionId).sort((a, b) => a - b);
  const nextIds = uniqueIds.slice().sort((a, b) => a - b);
  const changed = previousIds.length !== nextIds.length || previousIds.some((id, i) => id !== nextIds[i]);

  if (changed) {
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: uniqueIds.map((permissionId) => ({ roleId, permissionId })),
      });
    });

    await writeAuditLog({
      module: "role",
      action: "update-permissions",
      tableName: "Role",
      recordId: String(roleId),
      oldValues: { name: role.name, permissionIds: previousIds },
      newValues: { name: role.name, permissionIds: nextIds },
      user: actor,
      branchId: actor.branchId,
    });
  }

  return getRole(roleId);
}
