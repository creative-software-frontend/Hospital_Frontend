import { prisma } from "../../lib/prisma";

/**
 * Bed & Ward is four setup lists that share the exact same shape (branch-scoped
 * name + code + description + status). The `kind` in the URL picks which one,
 * and everything downstream — validation, service, audit label — is driven from
 * this registry instead of four near-identical CRUD stacks.
 */
export const BED_WARD_KINDS = ["floors", "bed-types", "bed-groups", "bed-statuses"] as const;

export type BedWardKind = (typeof BED_WARD_KINDS)[number];

export interface BedWardSpec {
  readonly kind: BedWardKind;
  /** Prisma model name, used in audit rows and error messages. */
  readonly tableName: string;
  /** Human label, e.g. "Bed Type". */
  readonly label: string;
  /** Audit module string, e.g. "bedWard.bedType". */
  readonly module: string;
}

export const BED_WARD_SPECS: Record<BedWardKind, BedWardSpec> = {
  floors: { kind: "floors", tableName: "Floor", label: "Floor", module: "bedWard.floor" },
  "bed-types": { kind: "bed-types", tableName: "BedType", label: "Bed Type", module: "bedWard.bedType" },
  "bed-groups": { kind: "bed-groups", tableName: "BedGroup", label: "Bed Group", module: "bedWard.bedGroup" },
  "bed-statuses": { kind: "bed-statuses", tableName: "BedStatus", label: "Bed Status", module: "bedWard.bedStatus" },
};

export function isBedWardKind(value: string): value is BedWardKind {
  return (BED_WARD_KINDS as readonly string[]).includes(value);
}

/** The columns every Bed & Ward list exposes and accepts. */
export const BED_WARD_SELECT = {
  id: true,
  branchId: true,
  name: true,
  code: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface BedWardRow {
  id: number;
  branchId: number;
  name: string;
  code: string;
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Minimal structural view of a Prisma delegate. All four models are identical,
 * so this is enough to drive them generically without inventing per-model types.
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
};
