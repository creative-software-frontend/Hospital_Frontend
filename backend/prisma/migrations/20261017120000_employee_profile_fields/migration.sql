-- Extend Employee with the personal / profile detail and attachment columns the
-- HR employee form captures (mirrors the Doctor/Nurse profile fields added in
-- 20261011130000 + 20261012130000). Every column is nullable, so existing rows
-- are unaffected.

ALTER TABLE `Employee`
  ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL AFTER `email`,
  ADD COLUMN `dateOfBirth` DATETIME(3) NULL AFTER `gender`,
  ADD COLUMN `maritalStatus` ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED') NULL AFTER `dateOfBirth`,
  ADD COLUMN `bloodGroup` ENUM('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG') NULL AFTER `maritalStatus`,
  ADD COLUMN `photo` VARCHAR(500) NULL AFTER `bloodGroup`,
  ADD COLUMN `permanentAddress` VARCHAR(500) NULL AFTER `photo`,
  ADD COLUMN `presentAddress` VARCHAR(500) NULL AFTER `permanentAddress`;
