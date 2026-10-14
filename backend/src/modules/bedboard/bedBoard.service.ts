import { prisma } from "../../lib/prisma";
import type { AuthUser } from "../../types/auth";
import type { BedOccupancyStatus } from "../bedward/bedWard.registry";

export interface BedBoardBed {
  id: number;
  name: string;
  status: BedOccupancyStatus;
  bedType: { id: number; name: string };
}

export interface BedBoardWard {
  id: number;
  name: string;
  color: string | null;
  total: number;
  available: number;
  occupied: number;
  unused: number;
  beds: BedBoardBed[];
}

export interface BedBoardFloor {
  id: number;
  name: string;
  wardCount: number;
  total: number;
  available: number;
  occupied: number;
  unused: number;
  wards: BedBoardWard[];
}

export interface BedBoardSummary {
  total: number;
  available: number;
  occupied: number;
  unused: number;
  occupiedPercent: number;
}

export interface BedBoard {
  branchId: number;
  summary: BedBoardSummary;
  floors: BedBoardFloor[];
}

interface Counts {
  available: number;
  occupied: number;
  unused: number;
}

function tally(beds: readonly { status: BedOccupancyStatus }[]): Counts {
  const counts: Counts = { available: 0, occupied: 0, unused: 0 };
  for (const bed of beds) {
    if (bed.status === "OCCUPIED") counts.occupied += 1;
    else if (bed.status === "UNUSED") counts.unused += 1;
    else counts.available += 1;
  }
  return counts;
}

/**
 * Full bed board for a branch: floors -> bed groups (wards) -> beds, each level
 * carrying Available / Occupied / Unused counts plus an overall summary. Read
 * model only — any authenticated staff member may view it from the top bar.
 */
export async function getBedBoard(actor: AuthUser, branchId?: number): Promise<BedBoard> {
  const targetBranch = branchId ?? actor.branchId;

  const floors = await prisma.floor.findMany({
    where: { branchId: targetBranch },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      bedGroups: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          bedDefinitions: {
            orderBy: { id: "asc" },
            select: {
              id: true,
              name: true,
              status: true,
              bedType: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const boardFloors: BedBoardFloor[] = floors.map((floor) => {
    const wards: BedBoardWard[] = floor.bedGroups.map((group) => {
      const beds: BedBoardBed[] = group.bedDefinitions.map((bed) => ({
        id: bed.id,
        name: bed.name,
        status: bed.status as BedOccupancyStatus,
        bedType: bed.bedType,
      }));
      return {
        id: group.id,
        name: group.name,
        color: group.color,
        total: beds.length,
        ...tally(beds),
        beds,
      };
    });

    const floorBeds = wards.flatMap((ward) => ward.beds);
    return {
      id: floor.id,
      name: floor.name,
      wardCount: wards.length,
      total: floorBeds.length,
      ...tally(floorBeds),
      wards,
    };
  });

  const summary: BedBoardSummary = { total: 0, available: 0, occupied: 0, unused: 0, occupiedPercent: 0 };
  for (const floor of boardFloors) {
    summary.total += floor.total;
    summary.available += floor.available;
    summary.occupied += floor.occupied;
    summary.unused += floor.unused;
  }
  summary.occupiedPercent = summary.total === 0 ? 0 : Math.round((summary.occupied / summary.total) * 100);

  return { branchId: targetBranch, summary, floors: boardFloors };
}
