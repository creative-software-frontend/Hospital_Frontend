-- PURPOSE: Remove drift address columns from Doctor and Nurse that are not declared in
--          schema.prisma, have no code references, and are either NULL or duplicate the
--          canonical generic columns (division/district/upazila).
--          Also reconcile the Nurse table by adding the four address columns that
--          Prisma already declares but the database is missing (critical drift).
--
-- PRECONDITION (verified):
--   SELECT COUNT(*) FROM Doctor WHERE permanentDivision IS NOT NULL;   -- 0
--   SELECT COUNT(*) FROM Doctor WHERE presentDivision IS NOT NULL;     -- 2 (rows 19,20; values duplicate division/district/upazila)
--   SELECT COUNT(*) FROM Nurse  WHERE presentDivision IS NOT NULL OR permanentDivision IS NOT NULL OR nationalId IS NOT NULL; -- 0
--   SELECT VERSION(); -- 10.4.32-MariaDB (supports IF NOT EXISTS / IF EXISTS)
--
-- POST-CHECK:
--   SHOW COLUMNS FROM Doctor;  -- no present*/permanent* columns
--   SHOW COLUMNS FROM Nurse;   -- has division/district/upazila/thana; no present*/permanent*/nationalId
--
-- ARCHIVE (doctor present* values, preserved here for audit):
--   id 19: presentDivision='DIV_DHAKA', presentDistrict='Dhaka', presentUpazila='Dhamrai' (dup of division/district/upazila)
--   id 20: presentDivision='DIV_DHAKA', presentDistrict='Dhaka', presentUpazila='Dhamrai' (dup of division/district/upazila)
--
-- ROLLBACK: restore the columns from the pre-cleanup backup
--   D:\React_projects\hospital-frontend\backend\backup_pre_cleanup\hospital_management_20261110_185842.sql
--   or run the inverse ALTERs:
--     ALTER TABLE `Nurse` ADD COLUMN `presentDivision` VARCHAR(191) NULL, ... (etc.)
--     ALTER TABLE `Doctor` ADD COLUMN `presentDivision` VARCHAR(191) NULL, ... (etc.)
--     ALTER TABLE `Nurse` DROP COLUMN `division`, ... (only if the reconcile added them)
--
-- NOTE: This migration does NOT change schema.prisma (Prisma already declares
--       division/district/upazila/thana on Nurse and does NOT declare the drift columns).

-- Nurse: add the four address columns Prisma declares but the DB is missing (guarded).
ALTER TABLE `Nurse` ADD COLUMN IF NOT EXISTS `division` VARCHAR(191) NULL;
ALTER TABLE `Nurse` ADD COLUMN IF NOT EXISTS `district` VARCHAR(191) NULL;
ALTER TABLE `Nurse` ADD COLUMN IF NOT EXISTS `upazila` VARCHAR(191) NULL;
ALTER TABLE `Nurse` ADD COLUMN IF NOT EXISTS `thana` VARCHAR(191) NULL;

-- Nurse: drop orphan drift columns (guarded).
ALTER TABLE `Nurse` DROP COLUMN IF EXISTS `presentDivision`;
ALTER TABLE `Nurse` DROP COLUMN IF EXISTS `presentDistrict`;
ALTER TABLE `Nurse` DROP COLUMN IF EXISTS `presentUpazila`;
ALTER TABLE `Nurse` DROP COLUMN IF EXISTS `permanentDivision`;
ALTER TABLE `Nurse` DROP COLUMN IF EXISTS `permanentDistrict`;
ALTER TABLE `Nurse` DROP COLUMN IF EXISTS `permanentUpazila`;
ALTER TABLE `Nurse` DROP COLUMN IF EXISTS `nationalId`;

-- Doctor: drop orphan drift columns (guarded).
ALTER TABLE `Doctor` DROP COLUMN IF EXISTS `presentDivision`;
ALTER TABLE `Doctor` DROP COLUMN IF EXISTS `presentDistrict`;
ALTER TABLE `Doctor` DROP COLUMN IF EXISTS `presentUpazila`;
ALTER TABLE `Doctor` DROP COLUMN IF EXISTS `permanentDivision`;
ALTER TABLE `Doctor` DROP COLUMN IF EXISTS `permanentDistrict`;
ALTER TABLE `Doctor` DROP COLUMN IF EXISTS `permanentUpazila`;
