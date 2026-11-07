import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type {
  CreateShiftTypeInput,
  ListShiftTypesQuery,
  UpdateShiftTypeInput,
} from "./shift-type.validation";

const SHIFT_TYPE_SELECT = {
  id: true,
  name: true,
  startTime: true,
  endTime: true,
  graceMinutes: true,
  status: true,
} satisfies Prisma.ShiftTypeSelect;

export async function listShiftTypes(query: ListShiftTypesQuery) {
  const where: Prisma.ShiftTypeWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.search) where.name = { contains: query.search };

  return prisma.shiftType.findMany({
    where,
    select: SHIFT_TYPE_SELECT,
    orderBy: { name: "asc" },
  });
}

export async function getShiftType(id: number) {
  const shiftType = await prisma.shiftType.findUnique({
    where: { id },
    select: SHIFT_TYPE_SELECT,
  });
  if (!shiftType) {
    const error = new Error("Shift type not found");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }
  return shiftType;
}

export async function createShiftType(input: CreateShiftTypeInput) {
  return prisma.shiftType.create({
    data: {
      name: input.name,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      graceMinutes: input.graceMinutes ?? 0,
      status: input.status ?? "active",
    },
    select: SHIFT_TYPE_SELECT,
  });
}

export async function updateShiftType(id: number, input: UpdateShiftTypeInput) {
  await getShiftType(id);
  return prisma.shiftType.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.graceMinutes !== undefined ? { graceMinutes: input.graceMinutes } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    select: SHIFT_TYPE_SELECT,
  });
}
