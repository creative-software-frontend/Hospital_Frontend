-- Add permanent / present address columns to Doctor and Nurse so both forms
-- capture full contact details. Every column is nullable, so existing rows are
-- unaffected.

ALTER TABLE `Doctor`
  ADD COLUMN `permanentAddress` VARCHAR(500) NULL AFTER `email`,
  ADD COLUMN `presentAddress` VARCHAR(500) NULL AFTER `permanentAddress`;

ALTER TABLE `Nurse`
  ADD COLUMN `permanentAddress` VARCHAR(500) NULL AFTER `email`,
  ADD COLUMN `presentAddress` VARCHAR(500) NULL AFTER `permanentAddress`;
