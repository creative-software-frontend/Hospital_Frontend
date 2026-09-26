/**
 * Syncs the Bangladesh administrative hierarchy into Master Data.
 *
 * Master Data stays the thing the UI reads from, so this script is how the
 * national dataset gets in. It is safe to re-run: rows are matched on
 * (branch, category, code) and labels are refreshed in place, so an admin's
 * status/sortOrder edits survive. Only codes that no longer exist in the
 * dataset are deactivated, never deleted, to avoid orphaning patients that
 * already reference them.
 *
 *   npm run seed:address
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildAddressSeedRows } from "./addressSeedData";
import { ADDRESS_CATEGORY_ORDER } from "../src/lib/bangladeshAddress";

const prisma = new PrismaClient();

async function main() {
  const rows = buildAddressSeedRows();
  const categories = new Set(ADDRESS_CATEGORY_ORDER as readonly string[]);
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });

  if (branches.length === 0) {
    throw new Error("No branches found. Run `npm run prisma:seed` first.");
  }

  const byCategory = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + 1;
    return acc;
  }, {});
  console.log(
    `Dataset: ${ADDRESS_CATEGORY_ORDER.map((c) => `${c}=${byCategory[c] ?? 0}`).join(", ")}`,
  );

  for (const branch of branches) {
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const existing = await prisma.masterData.findFirst({
        where: { branchId: branch.id, category: row.category, code: row.code },
      });

      if (existing) {
        // Label/parent can change when the national dataset is updated; the
        // admin's own status and sortOrder are left untouched.
        if (existing.label !== row.label || existing.parentCode !== row.parentCode) {
          await prisma.masterData.update({
            where: { id: existing.id },
            data: { label: row.label, parentCode: row.parentCode },
          });
          updated += 1;
        }
      } else {
        await prisma.masterData.create({
          data: {
            branchId: branch.id,
            category: row.category,
            label: row.label,
            code: row.code,
            parentCode: row.parentCode,
            sortOrder: row.sortOrder,
            status: "active",
          },
        });
        created += 1;
      }
    }

    // Anything in an address category that the dataset no longer lists.
    const stale = await prisma.masterData.findMany({
      where: {
        branchId: branch.id,
        category: { in: [...categories] },
        status: "active",
        NOT: { code: { in: rows.map((r) => r.code) } },
      },
      select: { id: true, category: true, code: true },
    });
    for (const row of stale) {
      await prisma.masterData.update({
        where: { id: row.id },
        data: { status: "inactive" },
      });
    }

    console.log(
      `${branch.name}: created ${created}, refreshed ${updated}, deactivated ${stale.length}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
