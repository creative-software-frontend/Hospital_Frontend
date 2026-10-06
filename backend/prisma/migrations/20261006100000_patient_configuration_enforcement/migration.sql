-- P1 Patient Configuration
--
-- 1. Patient.patientType stores the branch's defaultPatientType so the setting
--    actually reaches the patient record.
-- 2. PatientSetting becomes one-row-per-branch, which is what every reader
--    already assumes (findFirst orderBy id asc). Without the unique key two
--    concurrent first-time GETs could create two divergent rows.
-- 3. Indexes backing duplicate detection on nationalId and email, so enabling
--    it cannot turn registration into a table scan.

ALTER TABLE `Patient`
  ADD COLUMN `patientType` VARCHAR(32) NOT NULL DEFAULT 'NEW';

-- Collapse any accidental duplicates before enforcing one row per branch: keep
-- the most recently touched row, which is the one an admin last edited.
DELETE `a` FROM `PatientSetting` AS `a`
  JOIN `PatientSetting` AS `b`
    ON `a`.`branchId` = `b`.`branchId`
   AND `a`.`id` < `b`.`id`;

ALTER TABLE `PatientSetting`
  ADD UNIQUE INDEX `PatientSetting_branchId_key` (`branchId`);

CREATE INDEX `Patient_nationalId_idx` ON `Patient` (`nationalId`);
CREATE INDEX `Patient_email_idx` ON `Patient` (`email`);