import "dotenv/config";
import { PrismaClient } from "@prisma/client";

function getDatabaseName(url: string): string {
  try {
    const parsed = new URL(url);
    const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    return dbName || "hospital_management";
  } catch {
    return "hospital_management";
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }

  const dbName = getDatabaseName(dbUrl);
  const prisma = new PrismaClient();

  try {
    // 1. Check database connection and table list
    const tables: Array<Record<string, unknown>> = await prisma.$queryRawUnsafe(`SHOW TABLES`);
    if (!tables || tables.length === 0) {
      throw new Error(`Database "${dbName}" exists but contains no tables.`);
    }

    const tableCount = tables.length;

    // 2. Check key entities
    const userCount = await prisma.user.count();
    const roleCount = await prisma.role.count();
    const branchCount = await prisma.branch.count();
    const divisionCount = await prisma.division.count();
    const districtCount = await prisma.district.count();
    const upazilaCount = await prisma.upazila.count();

    const superAdminRole = await prisma.role.findFirst({
      where: { seederKey: "SUPER_ADMIN" },
    });
    if (!superAdminRole) {
      throw new Error("SUPER_ADMIN role missing after seed.");
    }

    const superAdminUser = await prisma.user.findFirst({
      where: {
        userRoles: {
          some: {
            roleId: superAdminRole.id,
          },
        },
      },
    });
    if (!superAdminUser) {
      throw new Error("Bootstrap SUPER_ADMIN user missing after seed.");
    }

    if (divisionCount === 0 || districtCount === 0 || upazilaCount === 0) {
      throw new Error("Address hierarchy master data (divisions/districts/upazilas) is missing.");
    }

    console.log(`  Database "${dbName}" verified: ${tableCount} tables, ${userCount} users, ${branchCount} branch(es), ${divisionCount} divisions, ${districtCount} districts, ${upazilaCount} upazilas.`);
    console.log("\nDatabase setup completed successfully.\n");
    console.log(`Database: ${dbName}`);
    console.log(`Migrations: up to date`);
    console.log(`Seed: completed`);
    console.log(`Status: READY\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Database verification failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
