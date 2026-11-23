-- PURPOSE: Batches 4-8 cleanup — remove all unimplemented/unused tables.
--   Batch 4: inventorycategory, warehouse, inventoryitem, inventorystock
--   Batch 5: accountcategory, account, accountingtransaction, accountingentry
--   Batch 6: payment, paymentallocation
--   Batch 7: medicinecategory, medicineunit
--   Batch 8: prescriptiontemplate, union
--
-- PRECONDITION (verified):
--   All 14 tables have 0 rows except `union` (9,080 imported reference rows).
--   No active backend service or frontend code references them (0 prisma.* refs).
--   Surviving-table FKs to dropped tables: Medicine.categoryId, Medicine.unitId,
--   PrescriptionSetting.templateId (handled below).
--
-- POST-CHECK: SHOW TABLES should no longer list the 14 tables above.
-- ROLLBACK: restore from backend/backups/pre_batch4_8_*.sql
--
-- NOTE: `union` removal loses 9,080 imported national reference rows.
--       `prescriptiontemplate` had 0 rows.

-- 1. Drop FKs from surviving tables to dropped tables.
ALTER TABLE `medicine` DROP FOREIGN KEY IF EXISTS `Medicine_categoryId_fkey`;
ALTER TABLE `medicine` DROP FOREIGN KEY IF EXISTS `Medicine_unitId_fkey`;
ALTER TABLE `prescriptionsetting` DROP FOREIGN KEY IF EXISTS `PrescriptionSetting_templateId_fkey`;

-- 2. Drop orphaned columns from surviving tables.
ALTER TABLE `medicine` DROP INDEX IF EXISTS `Medicine_categoryId_idx`;
ALTER TABLE `medicine` DROP INDEX IF EXISTS `Medicine_unitId_idx`;
ALTER TABLE `medicine` DROP COLUMN IF EXISTS `categoryId`;
ALTER TABLE `medicine` DROP COLUMN IF EXISTS `unitId`;
ALTER TABLE `prescriptionsetting` DROP COLUMN IF EXISTS `templateId`;

-- 3. Drop all 14 tables (children first where FKs exist between dropped tables).
-- Inventory
DROP TABLE IF EXISTS `inventorystock`;
DROP TABLE IF EXISTS `inventoryitem`;
DROP TABLE IF EXISTS `warehouse`;
DROP TABLE IF EXISTS `inventorycategory`;
-- Accounting
DROP TABLE IF EXISTS `accountingentry`;
DROP TABLE IF EXISTS `accountingtransaction`;
DROP TABLE IF EXISTS `account`;
DROP TABLE IF EXISTS `accountcategory`;
-- Billing
DROP TABLE IF EXISTS `paymentallocation`;
DROP TABLE IF EXISTS `payment`;
-- Pharmacy lookups
DROP TABLE IF EXISTS `medicineunit`;
DROP TABLE IF EXISTS `medicinecategory`;
-- Other
DROP TABLE IF EXISTS `prescriptiontemplate`;
DROP TABLE IF EXISTS `union`;
