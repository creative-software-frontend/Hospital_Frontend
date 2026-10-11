-- Rename the Doctor "registrationNo" column to "bmdcRegistrationNo" to reflect
-- the BMDC (Bangladesh Medical & Dental Council) registration number. Uses
-- CHANGE so existing data is preserved rather than dropped and recreated.
ALTER TABLE `Doctor` CHANGE `registrationNo` `bmdcRegistrationNo` VARCHAR(191) NULL;

DROP INDEX `Doctor_registrationNo_idx` ON `Doctor`;

CREATE INDEX `Doctor_bmdcRegistrationNo_idx` ON `Doctor`(`bmdcRegistrationNo`);
