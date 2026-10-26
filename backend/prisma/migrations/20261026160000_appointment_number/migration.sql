ALTER TABLE `Appointment`
  ADD COLUMN `appointmentNumber` VARCHAR(32) NULL AFTER `id`;

UPDATE `Appointment`
SET `appointmentNumber` = CONCAT('APT-', LPAD(`id`, 6, '0'))
WHERE `appointmentNumber` IS NULL;

ALTER TABLE `Appointment`
  MODIFY `appointmentNumber` VARCHAR(32) NOT NULL,
  ADD UNIQUE INDEX `Appointment_branchId_appointmentNumber_key` (`branchId`, `appointmentNumber`);
