ALTER TABLE `Appointment`
  ADD COLUMN `doctorFee` DECIMAL(12, 2) NULL AFTER `status`,
  ADD COLUMN `shift` VARCHAR(191) NULL AFTER `doctorFee`,
  ADD COLUMN `appointmentPriority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL' AFTER `shift`,
  ADD COLUMN `discountPercentage` DECIMAL(5, 2) NULL AFTER `appointmentPriority`,
  ADD COLUMN `liveConsultant` BOOLEAN NOT NULL DEFAULT false AFTER `discountPercentage`,
  ADD COLUMN `paymentMode` VARCHAR(191) NULL AFTER `liveConsultant`,
  ADD COLUMN `message` VARCHAR(191) NULL AFTER `paymentMode`,
  ADD COLUMN `alternateAddress` VARCHAR(191) NULL AFTER `message`;
