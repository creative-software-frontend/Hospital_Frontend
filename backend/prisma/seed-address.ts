/**
 * Standalone re-sync of the Bangladesh address hierarchy.
 *
 * The normal seed already does this (see `prisma/seed.ts`), so you only need
 * this command when the underlying dataset changes, for example after bumping
 * @bangladeshi/bangladesh-address. Branches must already exist.
 *
 *   npm run seed:address
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
