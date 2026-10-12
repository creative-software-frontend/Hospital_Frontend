-- Remove the Nurse "registrationNo" column and its index; the nurse record no
-- longer tracks a registration number.
DROP INDEX `Nurse_registrationNo_idx` ON `Nurse`;
ALTER TABLE `Nurse` DROP COLUMN `registrationNo`;
