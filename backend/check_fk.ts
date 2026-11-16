import { prisma } from "./src/lib/prisma";

async function main() {
  const fks = await prisma.$queryRawUnsafe<any[]>(
    `SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IN ('Bed','BedDefinition')`
  );
  console.log(JSON.stringify(fks, null, 2));
  process.exit(0);
}
main();
