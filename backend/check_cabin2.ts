import { prisma } from "./src/lib/prisma";

async function main() {
  const types = await prisma.bedType.findMany({ select: { id: true, name: true, branchId: true } });
  console.log("Bed types:", JSON.stringify(types));
  const beds = await prisma.bedDefinition.findMany({
    select: { id: true, name: true, branchId: true, bedTypeId: true, status: true, bedType: { select: { name: true } } },
  });
  console.log("Beds:", JSON.stringify(beds));
  process.exit(0);
}
main();
