CREATE TABLE `ChamberSchedule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chamberId` INTEGER NOT NULL,
    `branchId` INTEGER NOT NULL,
    `doctorId` INTEGER NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `appointmentLimit` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `ChamberSchedule_branchId_chamberId_dayOfWeek_idx` (`branchId`, `chamberId`, `dayOfWeek`),
    INDEX `ChamberSchedule_branchId_doctorId_dayOfWeek_idx` (`branchId`, `doctorId`, `dayOfWeek`),
    UNIQUE INDEX `ChamberSchedule_chamberId_doctorId_dayOfWeek_key` (`chamberId`, `doctorId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `ChamberSchedule` ADD CONSTRAINT `ChamberSchedule_chamberId_fkey` FOREIGN KEY (`chamberId`) REFERENCES `Chamber`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ChamberSchedule` ADD CONSTRAINT `ChamberSchedule_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ChamberSchedule` ADD CONSTRAINT `ChamberSchedule_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `Doctor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
