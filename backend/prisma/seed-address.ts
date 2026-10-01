/**
 * Standalone re-sync of the Bangladesh address hierarchy.
 *
 * The normal seed deliberately does not do this (see `prisma/seed.ts`), so this
 * is the command to run when the vendored dumps in `prisma/address-source/`
 * change. Branches must already exist.
 *
 *   npm run seed:address
 *
 * `npm run seed:address:sql` is the sibling command: it writes the same rows to
 * `sql/address-master-data.sql` for upload in phpMyAdmin, which is how the
 * hospital loads them. Neither command is needed after the SQL has been
 * imported once.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { syncAddressMasterData } from "./syncAddressMasterData";

const prisma = new PrismaClient();

async function main() {
  const result = await syncAddressMasterData(prisma);

  console.log(
    `Dataset: ${Object.entries(result.byCategory)
      .map(([category, count]) => `${category}=${count}`)
      .join(", ")}`,
  );
  console.log(
    `Branches: ${result.branches} | created ${result.created}, refreshed ${result.refreshed}, deactivated ${result.deactivated}`,
  );
  console.log("Address master data synced.");
}

main()
  .catch((error) => {
    console.error("Address seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
