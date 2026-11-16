-- PURPOSE: Repoint BedTransfer (and Admission) foreign keys from the legacy `Bed`
--          table to `BedDefinition`, so bed transfers operate on the beds that the
--          UI actually creates (Bed Status / Bed Board). Legacy `Bed` rows: 0,
--          admissions: 0, bed transfers: 0 -> no data migration required.
--
-- PRECONDITION:
--   SELECT COUNT(*) FROM bedtransfer;  -- 0
--   SELECT COUNT(*) FROM admission;     -- 0
--   SELECT COUNT(*) FROM bed;          -- 0
--   SELECT COUNT(*) FROM beddefinition; -- > 0
--
-- POST-CHECK:
--   SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE
--     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('admission','bedtransfer')
--       AND REFERENCED_TABLE_NAME='BedDefinition';
--   (expect 3 rows: Admission_bedId_fkey, BedTransfer_fromBedId_fkey, BedTransfer_toBedId_fkey)
--
-- ROLLBACK: restore from backend/backups/hospital_management_20261110_185842.sql
--   or re-add the FKs to `bed`:
--     ALTER TABLE `admission` ADD CONSTRAINT `Admission_bedId_fkey`
--       FOREIGN KEY (`bedId`) REFERENCES `bed`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
--     ALTER TABLE `bedtransfer` ADD CONSTRAINT `BedTransfer_fromBedId_fkey`
--       FOREIGN KEY (`fromBedId`) REFERENCES `bed`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
--     ALTER TABLE `bedtransfer` ADD CONSTRAINT `BedTransfer_toBedId_fkey`
--       FOREIGN KEY (`toBedId`) REFERENCES `bed`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `admission` DROP FOREIGN KEY `Admission_bedId_fkey`;
ALTER TABLE `bedtransfer` DROP FOREIGN KEY `BedTransfer_fromBedId_fkey`;
ALTER TABLE `bedtransfer` DROP FOREIGN KEY `BedTransfer_toBedId_fkey`;

ALTER TABLE `admission` ADD CONSTRAINT `Admission_bedId_fkey`
  FOREIGN KEY (`bedId`) REFERENCES `BedDefinition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `bedtransfer` ADD CONSTRAINT `BedTransfer_fromBedId_fkey`
  FOREIGN KEY (`fromBedId`) REFERENCES `BedDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bedtransfer` ADD CONSTRAINT `BedTransfer_toBedId_fkey`
  FOREIGN KEY (`toBedId`) REFERENCES `BedDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
