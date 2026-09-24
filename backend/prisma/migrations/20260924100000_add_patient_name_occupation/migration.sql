-- AlterTable
-- Add a single `name` column, backfill it from firstName/lastName, then drop the split columns.

-- Step 1: add nullable `name`
ALTER TABLE `Patient` ADD COLUMN `name` VARCHAR(191) NULL;

-- Step 2: backfill `name` = trimmed(firstName + ' ' + lastName)
UPDATE `Patient` SET `name` = TRIM(CONCAT(COALESCE(`firstName`, ''), ' ', COALESCE(`lastName`, '')));

-- Step 3: enforce NOT NULL on `name`
ALTER TABLE `Patient` MODIFY COLUMN `name` VARCHAR(191) NOT NULL;

-- Step 4: drop the old split columns
ALTER TABLE `Patient` DROP COLUMN `firstName`;
ALTER TABLE `Patient` DROP COLUMN `lastName`;