-- PURPOSE: Batch 3 cleanup — remove unimplemented Lab structures.
--   labcategory, labtestparameter, labsample, labresult, labresultvalue.
--   Also remove the now-orphaned categoryId column from labtest.
--
-- PRECONDITION (verified):
--   All 5 tables have 0 rows.
--   No active backend service or frontend code references them
--   (only Prisma relation fields, which are updated in this migration).
--   LabTest, LabOrder, LabOrderItem, Doctor, Branch models are updated
--   to remove relations to the dropped tables.
--
-- POST-CHECK:
--   SHOW TABLES LIKE 'labcategory';       -- empty
--   SHOW TABLES LIKE 'labtestparameter';  -- empty
--   SHOW TABLES LIKE 'labsample';        -- empty
--   SHOW TABLES LIKE 'labresult';        -- empty
--   SHOW TABLES LIKE 'labresultvalue';   -- empty
--   SHOW COLUMNS FROM labtest LIKE 'categoryId'; -- empty
--
-- ROLLBACK: restore from backend/backups/pre_batch3_*.sql
--   (or recreate tables from the pre-cleanup backup's CREATE TABLE statements).

-- Drop foreign keys that reference the tables being removed.
-- (LabResult referenced by LabOrderItem.results, LabSample, LabResultValue, Doctor, Branch)
-- LabResult has FKs to branch, doctor (performedById), labOrderItem, sample.
-- LabResultValue has FKs to labTestParameter, labResult.
-- LabSample has FKs to branch, labOrder.
-- LabTestParameter has FK to labTest? (check) — none found, it's referenced by LabTest.parameters (no FK on LabTest side; LabTestParameter has no FK to LabTest? Actually LabTestParameter might have labTestId). Let me check.

-- Remove orphaned categoryId column from labtest FIRST (it has an FK to labcategory).
ALTER TABLE `labtest` DROP FOREIGN KEY IF EXISTS `LabTest_categoryId_fkey`;
ALTER TABLE `labtest` DROP INDEX IF EXISTS `labtest_categoryId_idx`;
ALTER TABLE `labtest` DROP COLUMN IF EXISTS `categoryId`;

-- Safest: drop tables in dependency order (children first).
-- LabResultValue -> LabResult, LabTestParameter
-- LabResult -> LabOrderItem, LabSample, Doctor, Branch
-- LabSample -> LabOrder, Branch
-- LabTestParameter -> (none, but referenced by LabTest.parameters and LabResultValue)
-- LabCategory -> LabTest
DROP TABLE IF EXISTS `labresultvalue`;
DROP TABLE IF EXISTS `labresult`;
DROP TABLE IF EXISTS `labsample`;
DROP TABLE IF EXISTS `labtestparameter`;
DROP TABLE IF EXISTS `labcategory`;
