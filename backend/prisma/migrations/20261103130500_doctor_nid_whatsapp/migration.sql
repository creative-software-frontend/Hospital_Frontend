ALTER TABLE `Doctor`
  ADD COLUMN `nationalId` VARCHAR(191) NULL AFTER `bmdcRegistrationNo`,
  ADD COLUMN `whatsapp` VARCHAR(191) NULL AFTER `phone`;
