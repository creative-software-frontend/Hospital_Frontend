import { prisma } from "../../lib/prisma";

/**
 * Bed & Ward is a set of branch-scoped setup lists. The `kind` in the URL picks
 * which one, and everything downstream — validation, select shape, search
 * fields, FK checks, audit label — is driven from this registry instead of
 * near-identical CRUD stacks.
 */
export const BED_WARD_KINDS = [
  "floors",
  "bed-types",
  "bed-groups",
  "bed-statuses",
  "beds",
] as const;

export type BedWardKind = (typeof BED_WARD_KINDS)[number];

export interface BedWardRelation {
  /** FK field on this list's input, e.g. "floorId". */
  readonly field: string;
  /** Kind whose rows the FK must point at. */
  readonly targetKind: BedWardKind;
}

export interface BedWardSpec {
  readonly kind: BedWardKind;
  /** Prisma model name, used in audit rows and error messages. */
  readonly tableName: string;
  /** Human label, e.g. "Bed Type". */
  readonly label: string;
  /** Audit module string, e.g. "bedWard.bedType". */
  readonly module: string;
  /** Columns exposed by the list/read endpoints. */
  readonly select: Record<string, unknown>;
  /** Columns matched by the `search` query, e.g. ["name", "description"]. */
  readonly searchFields: readonly string[];
  /** FK fields that must reference an existing row of another list. */
  readonly relations: readonly BedWardRelation[];
}

const nameAndTimestamps = {
  id: true,
  branchId: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const BED_WARD_SPECS: Record<BedWardKind, BedWardSpec> = {
  floors: {
    kind: "floors",
    tableName: "Floor",
    label: "Floor",
    module: "bedWard.floor",
    select: { ...nameAndTimestamps, description: true },
    searchFields: ["name", "description"],
    relations: [],
  },
  "bed-types": {
    kind: "bed-types",
    tableName: "BedType",
    label: "Bed Type",
    module: "bedWard.bedType",
    select: { ...nameAndTimestamps },
    searchFields: ["name"],
    relations: [],
  },
  "bed-groups": {
    kind: "bed-groups",
    tableName: "BedGroup",
    label: "Bed Group",
    module: "bedWard.bedGroup",
    select: {
      ...nameAndTimestamps,
      floorId: true,
      color: true,
      description: true,
      floor: { select: { id: true, name: true } },
    },
    searchFields: ["name", "description"],
    relations: [{ field: "floorId", targetKind: "floors" }],
  },
  "bed-statuses": {
    kind: "bed-statuses",
    tableName: "BedStatus",
    label: "Bed Status",
    module: "bedWard.bedStatus",
    select: { ...nameAndTimestamps },
    searchFields: ["name"],
    relations: [],
  },
  beds: {
    kind: "beds",
    tableName: "BedDefinition",
    label: "Bed",
    module: "bedWard.bed",
    select: {
      ...nameAndTimestamps,
      bedTypeId: true,
      bedGroupId: true,
      notAvailableForUse: true,
      bedType: { select: { id: true, name: true } },
      bedGroup: { select: { id: true, name: true, floor: { select: { id: true, name: true } } } },
    },
    searchFields: ["name"],
    relations: [
      { field: "bedTypeId", targetKind: "bed-types" },
      { field: "bedGroupId", targetKind: "bed-groups" },
    ],
  },
};

export function isBedWardKind(value: string): value is BedWardKind {
  return (BED_WARD_KINDS as readonly string[]).includes(value);
}

export type BedWardRow = { id: number; branchId: number; name: string } & Record<string, unknown>;

/**
 * Minimal structural view of a Prisma delegate, enough to drive the lists
 * generically without inventing per-model types.
 */
export interface BedWardDelegate {
  count(args: { where?: Record<string, unknown> }): Promise<number>;
  findMany(args: Record<string, unknown>): Promise<BedWardRow[]>;
  findFirst(args: Record<string, unknown>): Promise<BedWardRow | null>;
  findUnique(args: Record<string, unknown>): Promise<BedWardRow | null>;
  create(args: Record<string, unknown>): Promise<BedWardRow>;
  update(args: Record<string, unknown>): Promise<BedWardRow>;
}

export const BED_WARD_DELEGATES: Record<BedWardKind, BedWardDelegate> = {
  floors: prisma.floor as unknown as BedWardDelegate,
  "bed-types": prisma.bedType as unknown as BedWardDelegate,
  "bed-groups": prisma.bedGroup as unknown as BedWardDelegate,
  "bed-statuses": prisma.bedStatus as unknown as BedWardDelegate,
  beds: prisma.bedDefinition as unknown as BedWardDelegate,
};
