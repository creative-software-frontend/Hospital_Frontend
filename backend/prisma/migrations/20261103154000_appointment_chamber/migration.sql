ALTER TABLE `Appointment` ADD COLUMN `chamberId` INTEGER NULL;
CREATE INDEX `Appointment_chamberId_idx` ON `Appointment`(`chamberId`);
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_chamberId_fkey` FOREIGN KEY (`chamberId`) REFERENCES `Chamber`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
