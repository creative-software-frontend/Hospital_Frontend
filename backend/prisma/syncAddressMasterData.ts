/**
 * Writes the Bangladesh administrative hierarchy into the dedicated address tables.
 *
 * Each level is its own table now (`Division` -> `District` -> `Upazila` -> `Union`)
 * and the levels are joined by real foreign keys, so this has to insert strictly top
 * down: a district cannot be created before the division it points at exists. The
 * dataset still arrives with `parentCode` strings, so this resolves each one to the
 * parent row's id as it goes.
 *
 * The data comes from the vendored SQL dumps in `address-source/` (see
 * `addressDataset.ts`).
 *
 * It has two entry points:
 *
 *   - `prisma/seed-address.ts`   -> re-syncs from the vendored dumps.
 *   - `prisma/generateAddressSql.ts` -> emits the same rows as an uploadable
 *     .sql file, which is how the hospital actually loads them.
 *
 * The normal seed does not call this: address data is reference data, so a fresh
 * install loads it by importing the generated SQL rather than having it re-inserted
 * (and potentially overwritten) on every setup run.
 *
 * It is safe to re-run. Rows are matched on (branch, code) and names are refreshed in
 * place, so an admin's status/sortOrder edits survive. Only codes that no longer
 * exist in the dataset are deactivated, never deleted, so no child row is orphaned
 * and no patient is left pointing at a place that cannot be resolved.
 *
 * Rows are read once per branch and level and written in batches rather than queried
 * per row: the dataset is 5106 rows replicated across every branch, and the naive
 * one-query-per-row version issued ~15k sequential round trips.
 */
import type { PrismaClient } from "@prisma/client";
import { buildAddressRows, type AddressRow } from "./addressDataset";
import { ADDRESS_CATEGORY_ORDER } from "../src/lib/bangladeshAddress";
import { LOOKUP_SPECS, type MasterDataCategory } from "../src/lib/masterDataRegistry";

/** Batched to keep the statement under MySQL's packet/placeholder limits. */
const WRITE_CHUNK = 200;

export interface AddressSyncResult {
  branches: number;
  created: number;
  refreshed: number;
  deactivated: number;
  byCategory: Record<string, number>;
}

/** Structural view of one address table, since each has its own Prisma delegate. */
interface TableDelegate {
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  createMany(args: Record<string, unknown>): Promise<unknown>;
  update(args: Record<string, unknown>): Promise<unknown>;
  updateMany(args: Record<string, unknown>): Promise<unknown>;
}

const delegateOf = (prisma: PrismaClient, model: string) =>
  (prisma as unknown as Record<string, TableDelegate>)[model];

const key = (category: string, code: string) => `${category}::${code}`;

export async function syncAddressMasterData(prisma: PrismaClient): Promise<AddressSyncResult> {
  const rows = buildAddressRows();
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });

  if (branches.length === 0) {
    throw new Error(
      "No branches found, so the address hierarchy cannot be attached to one. " +
        "This usually means the seed has not run yet.",
    );
  }

  const byCategory = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {});

  const result: AddressSyncResult = {
    branches: branches.length,
    created: 0,
    refreshed: 0,
    deactivated: 0,
    byCategory,
  };

  for (const branch of branches) {
    /**
     * Every code written so far for this branch, mapped to its row id. Populated as
     * each level is processed, which is how a child resolves its `parentCode`.
     */
    const idByKey = new Map<string, number>();

    for (const category of ADDRESS_CATEGORY_ORDER as readonly MasterDataCategory[]) {
      const spec = LOOKUP_SPECS[category];
      const table = delegateOf(prisma, spec.model);
      const levelRows = rows.filter((r) => r.category === category);
      const datasetCodes = levelRows.map((r) => r.code);

      // The staleness check below compares against every dataset-owned column, so
      // each one has to be selected or it reads as undefined and the row looks
      // stale on every run.
      const compareSelect: Record<string, unknown> = {
        id: true,
        code: true,
        name: true,
        bnName: true,
        url: true,
      };
      if (spec.parent) compareSelect[spec.parent.field] = true;
      if (spec.hasCoordinates) {
        compareSelect.lat = true;
        compareSelect.lon = true;
      }

      const existing = await table.findMany({
        where: { branchId: branch.id },
        select: compareSelect,
      });

      // Keyed on the natural key the unique constraint uses, so a single pass
      // decides insert vs update.
      const existingByCode = new Map(
        existing.map((r) => [r.code as string, r as { id: number; name: string }]),
      );

      const toCreate: Array<Record<string, unknown>> = [];
      const toUpdate: Array<{ id: number; data: Record<string, unknown>; code: string }> = [];

      for (const row of levelRows) {
        const parentId = spec.parent ? idByKey.get(key(spec.parent.category, row.parentCode ?? "")) : null;
        if (spec.parent && (parentId === undefined || parentId === null)) {
          // buildAddressRows() already rejects orphans, so this means the hierarchy
          // is out of order or the parent level failed to load. Failing loudly beats
          // inserting rows the foreign key would reject anyway.
          throw new Error(
            `Cannot insert ${category} "${row.code}": no parent row for ${spec.parent?.category} "${row.parentCode}"`,
          );
        }

        // `lat`/`lon` only exist on districts; the dataset leaves them null elsewhere.
        const geo = spec.hasCoordinates ? { lat: row.lat, lon: row.lon } : {};
        const values: Record<string, unknown> = {
          name: row.label,
          bnName: row.bnName,
          url: row.url,
          ...geo,
        };

        const found = existingByCode.get(row.code);
        if (!found) {
          toCreate.push({
            branchId: branch.id,
            name: row.label,
            code: row.code,
            sortOrder: row.sortOrder,
            status: "active",
            bnName: row.bnName,
            url: row.url,
            ...geo,
            ...(spec.parent ? { [spec.parent.field]: parentId } : {}),
          });
          continue;
        }

        // Name/parent/geo can change when the national dataset is updated; the
        // admin's own status and sortOrder are left untouched.
        const stale =
          found.name !== row.label ||
          (found.bnName as string | null) !== row.bnName ||
          (found.url as string | null) !== row.url ||
          (spec.parent
            ? (found[spec.parent.field] as number | null) !== parentId
            : false) ||
          (spec.hasCoordinates
            ? (found.lat as number | null) !== row.lat || (found.lon as number | null) !== row.lon
            : false);
        if (stale) {
          toUpdate.push({
            id: found.id,
            code: row.code,
            data: {
              ...values,
              ...(spec.parent ? { [spec.parent.field]: parentId } : {}),
            },
          });
        }
      }

      for (let i = 0; i < toCreate.length; i += WRITE_CHUNK) {
        const chunk = toCreate.slice(i, i + WRITE_CHUNK);
        await table.createMany({ data: chunk, skipDuplicates: true });
        result.created += chunk.length;
      }

      for (const row of toUpdate) {
        await table.update({ where: { id: row.id }, data: row.data });
        result.refreshed += 1;
      }

      // Anything in this level the dataset no longer lists: mark inactive instead
      // of deleting, so child rows keep their foreign key and existing patients
      // keep their reference.
      const stale = await table.findMany({
        where: { branchId: branch.id, status: "active", code: { notIn: datasetCodes } },
        select: { id: true },
      });
      for (let i = 0; i < stale.length; i += WRITE_CHUNK) {
        const chunk = stale.slice(i, i + WRITE_CHUNK);
        await table.updateMany({
          where: { id: { in: chunk.map((r) => r.id as number) } },
          data: { status: "inactive" },
        });
        result.deactivated += chunk.length;
      }

      // Re-read the level now that inserts are done, so every code on it has an id
      // available for the next level's foreign keys. One query per level rather
      // than one per row.
      const finalRows = await table.findMany({
        where: { branchId: branch.id },
        select: { id: true, code: true },
      });
      for (const r of finalRows) {
        idByKey.set(key(category, r.code as string), r.id as number);
      }
    }
  }

  return result;
}

/** Exposed for the SQL generator so both entry points share one definition. */
export const ADDRESS_LEVELS = ADDRESS_CATEGORY_ORDER as readonly MasterDataCategory[];
export type { AddressRow };