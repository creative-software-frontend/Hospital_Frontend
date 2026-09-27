/**
 * Syncs the Bangladesh administrative hierarchy into Master Data.
 *
 * Master Data stays the thing the UI reads from, so this is how the national
 * dataset gets in. It is shared by two entry points:
 *
 *   - `prisma/seed.ts`        -> called as the last step of the normal seed, so
 *                                a single `prisma db seed` produces a fully
 *                                working app with populated address dropdowns.
 *   - `prisma/seed-address.ts`-> standalone re-sync for when the national
 *                                dataset package is updated.
 *
 * It is safe to re-run. Rows are matched on (branch, category, code) and labels
 * are refreshed in place, so an admin's status/sortOrder edits survive. Only
 * codes that no longer exist in the dataset are deactivated, never deleted, to
 * avoid orphaning patients that already reference them.
 *
 * Rows are read once per branch and written in batches rather than queried per
 * row: the dataset is 593 rows replicated across every branch, and the naive
 * one-query-per-row version issued ~1.8k sequential round trips.
 */
import type { PrismaClient } from "@prisma/client";
import { buildAddressSeedRows } from "./addressSeedData";
import { ADDRESS_CATEGORY_ORDER } from "../src/lib/bangladeshAddress";

const CATEGORIES = ADDRESS_CATEGORY_ORDER as readonly string[];

/** Batched to keep the statement under MySQL's packet/placeholder limits. */
const WRITE_CHUNK = 200;

export interface AddressSyncResult {
  branches: number;
  created: number;
  refreshed: number;
  deactivated: number;
  byCategory: Record<string, number>;
}

export async function syncAddressMasterData(prisma: PrismaClient): Promise<AddressSyncResult> {
  const rows = buildAddressSeedRows();
  const categories = [...CATEGORIES];
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

  const datasetCodes = rows.map((r) => r.code);

  for (const branch of branches) {
    const existing = await prisma.masterData.findMany({
      where: { branchId: branch.id, category: { in: categories } },
      select: { id: true, category: true, code: true, label: true, parentCode: true },
    });

    // Keyed on the natural key the unique constraint uses, so a single pass
    // decides insert vs update.
    const byCode = new Map(existing.map((row) => [`${row.category}::${row.code}`, row]));
    const toCreate: typeof rows = [];
    const toUpdate: Array<{ id: number; label: string; parentCode: string | null }> = [];

    for (const row of rows) {
      const found = byCode.get(`${row.category}::${row.code}`);
      if (!found) {
        toCreate.push(row);
      } else if (found.label !== row.label || found.parentCode !== row.parentCode) {
        // Label/parent can change when the national dataset is updated; the
        // admin's own status and sortOrder are left untouched.
        toUpdate.push({ id: found.id, label: row.label, parentCode: row.parentCode });
      }
    }

    for (let i = 0; i < toCreate.length; i += WRITE_CHUNK) {
      const chunk = toCreate.slice(i, i + WRITE_CHUNK);
      await prisma.masterData.createMany({
        data: chunk.map((row) => ({
          branchId: branch.id,
          category: row.category,
          label: row.label,
          code: row.code,
          parentCode: row.parentCode,
          sortOrder: row.sortOrder,
          status: "active",
        })),
        skipDuplicates: true,
      });
      result.created += chunk.length;
    }

    // Each row differs from its neighbours, so these are issued one statement at
    // a time; there are normally very few of them (0 unless the dataset changed).
    for (const row of toUpdate) {
      await prisma.masterData.update({
        where: { id: row.id },
        data: { label: row.label, parentCode: row.parentCode },
      });
      result.refreshed += 1;
    }

    // Anything in an address category that the dataset no longer lists: mark
    // inactive instead of deleting so existing patients keep their reference.
    const stale = await prisma.masterData.findMany({
      where: {
        branchId: branch.id,
        category: { in: categories },
        status: "active",
        NOT: { code: { in: datasetCodes } },
      },
      select: { id: true },
    });

    for (let i = 0; i < stale.length; i += WRITE_CHUNK) {
      const chunk = stale.slice(i, i + WRITE_CHUNK);
      await prisma.masterData.updateMany({
        where: { id: { in: chunk.map((r) => r.id) } },
        data: { status: "inactive" },
      });
      result.deactivated += chunk.length;
    }
  }

  return result;
}
