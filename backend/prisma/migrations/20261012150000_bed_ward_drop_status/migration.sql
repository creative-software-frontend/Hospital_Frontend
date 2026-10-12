-- Drop the "status" column from the Bed & Ward setup lists. Floor is a
-- pre-existing table reused by the module, and BedType/BedGroup/BedStatus are
-- the tables added by 20261012140000_bed_ward_setup. None of these lists need
-- a status flag.

-- AlterTable
ALTER TABLE `Floor` DROP COLUMN `status`;

-- AlterTable
ALTER TABLE `BedType` DROP COLUMN `status`;

-- AlterTable
ALTER TABLE `BedGroup` DROP COLUMN `status`;

-- AlterTable
ALTER TABLE `BedStatus` DROP COLUMN `status`;
