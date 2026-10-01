-- Removes the `city` and `area` lookup tables.
--
-- They were app-owned flat lists seeded with a handful of rows, not part of the
-- national address dataset and not referenced by any other table (only Branch
-- had a collection relation). Rather than keep two lists nobody uses, they are
-- dropped outright. `Branch.city` is an unrelated plain text column and stays.

-- DropForeignKey
ALTER TABLE `area` DROP FOREIGN KEY `Area_branchId_fkey`;

-- DropForeignKey
ALTER TABLE `city` DROP FOREIGN KEY `City_branchId_fkey`;

-- AlterTable
-- The split migration added a temporary database default to backfill existing
-- paymentmethod rows. Prisma manages `updatedAt` itself, so the default is
-- removed here to match the model and every other table.
ALTER TABLE `paymentmethod` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- DropTable
DROP TABLE `area`;

-- DropTable
DROP TABLE `city`;
