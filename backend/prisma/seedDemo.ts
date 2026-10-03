/**
 * Standalone refresh of the demo logins (one account per role, shared
 * password). The normal seed calls the same code, so this is only needed when
 * you want to (re)create the demo accounts without re-running the full setup.
 *
 *   npm run seed:demo
 *
 * Every account's password is reset to SEED_DEMO_PASSWORD (default "12345678"),
 * which keeps the frontend's Quick demo access buttons working. Requires the
 * roles and at least one branch to already exist.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, seedDemoAccounts } from "./demoAccounts";

const prisma = new PrismaClient();

async function main() {
  const branch = await prisma.branch.findFirst({ orderBy: { id: "asc" } });
  if (!branch) {
    throw new Error("No branch found. Run the normal seed first so a branch exists.");
  }

  const ready = await seedDemoAccounts(prisma, branch.id);

  console.log(`Demo accounts ready: ${ready}/${DEMO_ACCOUNTS.length} (branch: ${branch.code})`);
  for (const account of DEMO_ACCOUNTS) {
    console.log(`  ${account.role.padEnd(13)} ${account.email}  /  ${account.username}`);
  }
  console.log(`  password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Demo account seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
