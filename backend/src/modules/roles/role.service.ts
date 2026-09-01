import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../errors/ApiError";
import type { ListRolesQuery } from "./role.validation";

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
          permission: { select: { module: true, action: true, description: true } },
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
          permission: { select: { module: true, action: true, description: true } },
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
