import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type {
  CreateLeaveTypeInput,
  ListLeaveTypesQuery,
  UpdateLeaveTypeInput,
} from "./leave-type.validation";

const LEAVE_TYPE_SELECT = {
  id: true,
  name: true,
  daysAllowed: true,
  paid: true,
  status: true,
} satisfies Prisma.LeaveTypeSelect;

export async function listLeaveTypes(query: ListLeaveTypesQuery) {
  const where: Prisma.LeaveTypeWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.search) where.name = { contains: query.search };

  return prisma.leaveType.findMany({
    where,
    select: LEAVE_TYPE_SELECT,
    orderBy: { name: "asc" },
  });
}

export async function getLeaveType(id: number) {
  const leaveType = await prisma.leaveType.findUnique({
    where: { id },
    select: LEAVE_TYPE_SELECT,
  });
  if (!leaveType) {
    const error = new Error("Leave type not found");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }
  return leaveType;
}

export async function createLeaveType(input: CreateLeaveTypeInput) {
  return prisma.leaveType.create({
    data: {
      name: input.name,
      daysAllowed: input.daysAllowed ?? 0,
      paid: input.paid ?? true,
      status: input.status ?? "active",
    },
    select: LEAVE_TYPE_SELECT,
  });
}

export async function updateLeaveType(id: number, input: UpdateLeaveTypeInput) {
  await getLeaveType(id);
  return prisma.leaveType.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.daysAllowed !== undefined ? { daysAllowed: input.daysAllowed } : {}),
      ...(input.paid !== undefined ? { paid: input.paid } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    select: LEAVE_TYPE_SELECT,
  });
}

export async function deleteLeaveType(id: number) {
  await getLeaveType(id);
  await prisma.leaveType.delete({ where: { id } });
}
