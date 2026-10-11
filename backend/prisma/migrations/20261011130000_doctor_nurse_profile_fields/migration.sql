-- Extend the Doctor and Nurse records with personal / profile details and
-- attachment URLs (photo, signature, CV) so both forms capture the same
-- HR-style information. Every column is nullable, so existing rows are
-- unaffected.

ALTER TABLE `Doctor`
  ADD COLUMN `joiningDate` DATETIME(3) NULL AFTER `bmdcRegistrationNo`,
  ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL AFTER `joiningDate`,
  ADD COLUMN `dateOfBirth` DATETIME(3) NULL AFTER `gender`,
  ADD COLUMN `maritalStatus` ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED') NULL AFTER `dateOfBirth`,
  ADD COLUMN `bloodGroup` ENUM('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG') NULL AFTER `maritalStatus`,
  ADD COLUMN `photo` VARCHAR(191) NULL AFTER `bloodGroup`,
  ADD COLUMN `signature` VARCHAR(191) NULL AFTER `photo`,
  ADD COLUMN `cv` VARCHAR(191) NULL AFTER `signature`;

ALTER TABLE `Nurse`
  ADD COLUMN `joiningDate` DATETIME(3) NULL AFTER `registrationNo`,
  ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL AFTER `joiningDate`,
  ADD COLUMN `dateOfBirth` DATETIME(3) NULL AFTER `gender`,
  ADD COLUMN `maritalStatus` ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED') NULL AFTER `dateOfBirth`,
  ADD COLUMN `bloodGroup` ENUM('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG') NULL AFTER `maritalStatus`,
  ADD COLUMN `photo` VARCHAR(191) NULL AFTER `bloodGroup`,
  ADD COLUMN `signature` VARCHAR(191) NULL AFTER `photo`,
  ADD COLUMN `cv` VARCHAR(191) NULL AFTER `signature`;
