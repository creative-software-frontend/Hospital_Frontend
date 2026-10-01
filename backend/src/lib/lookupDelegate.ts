/**
 * A thin, uniformly-typed handle on the ten lookup tables.
 *
 * Every lookup table has the same core shape (`id`, `name`, `code`, `sortOrder`,
 * `status`, timestamps) and differs only in whether it carries `branchId`, an
 * optional parent foreign key, and the national dataset's `bnName`/`lat`/`lon`/`url`
 * columns. Prisma generates one strongly-typed delegate per model, but writing ten
 * near-identical code paths against them would defeat the point of the split, so the
 * service layer talks to this structural shape instead and maps rows explicitly.
 *
 * The trade is deliberate: the registry stays the single place that knows which
 * table backs which category, and the database still enforces every relationship.
 */
import { prisma } from "./prisma";
import type { LookupModelName, LookupSpec } from "./masterDataRegistry";

/** A lookup row after normalising the differing column names. */
export interface LookupRow {
  id: number;
  /** Null only for payment methods, which are global. */
  branchId: number | null;
  name: string;
  code: string;
  /** Id of the parent row, or null at the top of a hierarchy. */
  parentId: number | null;
  /** The parent's code, denormalised for the API's flat `parentCode` field. */
  parentCode: string | null;
  sortOrder: number;
  status: string;
  bnName: string | null;
  lat: number | null;
  lon: number | null;
  url: string | null;
}

export interface LookupDelegate {
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  count(args?: Record<string, unknown>): Promise<number>;
}

export function lookupDelegate(model: LookupModelName): LookupDelegate {
  return (prisma as unknown as Record<LookupModelName, LookupDelegate>)[model];
}

/**
 * The `select`/`include` a lookup query needs to produce a `LookupRow`.
 *
 * A parent foreign key is included under the parent's model name (Prisma names the
 * relation field after the model it points at, so `district.division`), which is
 * also what `spec.parent.model` holds.
 */
export function lookupSelect(spec: LookupSpec): Record<string, unknown> {
  const select: Record<string, unknown> = {
    id: true,
    name: true,
    code: true,
    sortOrder: true,
    status: true,
  };
  if (spec.branchScoped) select.branchId = true;
  if (spec.hasBnName) select.bnName = true;
  if (spec.hasCoordinates) {
    select.lat = true;
    select.lon = true;
  }
  if (spec.address) select.url = true;
  if (spec.parent) select[spec.parent.model] = { select: { code: true } };
  return select;
}

type RawRow = Record<string, unknown> & { name: string; code: string };

/** Maps a selected row onto `LookupRow`, filling the columns a model does not have. */
export function toLookupRow(spec: LookupSpec, raw: RawRow): LookupRow {
  const parent = spec.parent ? (raw[spec.parent.model] as { code: string } | null | undefined) : null;
  return {
    id: raw.id as number,
    branchId: spec.branchScoped ? ((raw.branchId as number | null) ?? null) : null,
    name: raw.name,
    code: raw.code,
    parentId: spec.parent ? ((raw[spec.parent.field] as number | null) ?? null) : null,
    parentCode: parent?.code ?? null,
    sortOrder: (raw.sortOrder as number | null) ?? 0,
    status: (raw.status as string | null) ?? "active",
    bnName: spec.hasBnName ? ((raw.bnName as string | null) ?? null) : null,
    lat: spec.hasCoordinates ? ((raw.lat as number | null) ?? null) : null,
    lon: spec.hasCoordinates ? ((raw.lon as number | null) ?? null) : null,
    url: spec.address ? ((raw.url as string | null) ?? null) : null,
  };
}

/** Scopes a `where` to one branch, except for the global lookup lists. */
export function branchScope(spec: LookupSpec, branchId: number): Record<string, unknown> {
  return spec.branchScoped ? { branchId } : {};
}