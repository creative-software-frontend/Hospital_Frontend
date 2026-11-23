-- PURPOSE: Batch 1 cleanup — remove tables verified as unused (0 code refs, 0 FKs, 0 rows).
--   smsgateway, emailsetting, salarycomponent.
--
-- PRECONDITION (verified):
--   SELECT COUNT(*) FROM smsgateway;      -- 0
--   SELECT COUNT(*) FROM emailsetting;    -- 0
--   SELECT COUNT(*) FROM salarycomponent; -- 0
--   No Prisma model back-references exist for any of the three.
--   No frontend or backend code references them.
--
-- POST-CHECK:
--   SHOW TABLES LIKE 'smsgateway';       -- empty
--   SHOW TABLES LIKE 'emailsetting';     -- empty
--   SHOW TABLES LIKE 'salarycomponent';  -- empty
--
-- ROLLBACK: restore from backend/backups/pre_batch1_*.sql
--   (or recreate the tables from the pre-cleanup backup's CREATE TABLE statements).

DROP TABLE IF EXISTS `smsgateway`;
DROP TABLE IF EXISTS `emailsetting`;
DROP TABLE IF EXISTS `salarycomponent`;
