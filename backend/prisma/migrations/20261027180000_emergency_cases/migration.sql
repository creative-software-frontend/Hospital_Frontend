-- CreateTable
CREATE TABLE `EmergencyCase` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `patientId` INTEGER NOT NULL,
    `doctorId` INTEGER NULL,
    `caseNumber` VARCHAR(191) NOT NULL,
    `priority` ENUM('CRITICAL', 'URGENT', 'NON_URGENT') NOT NULL DEFAULT 'URGENT',
    `arrivalMode` ENUM('AMBULANCE', 'WALK_IN', 'REFERRED', 'OTHER') NOT NULL DEFAULT 'WALK_IN',
    `chiefComplaint` VARCHAR(500) NULL,
    `triageNotes` VARCHAR(500) NULL,
    `unidentified` BOOLEAN NOT NULL DEFAULT false,
    `arrivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `registeredById` INTEGER NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmergencyCase_branchId_idx`(`branchId`),
    INDEX `EmergencyCase_patientId_idx`(`patientId`),
    INDEX `EmergencyCase_doctorId_idx`(`doctorId`),
    INDEX `EmergencyCase_arrivedAt_idx`(`arrivedAt`),
    INDEX `EmergencyCase_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `EmergencyCase_branchId_caseNumber_key`(`branchId`, `caseNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmergencyCase` ADD CONSTRAINT `EmergencyCase_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmergencyCase` ADD CONSTRAINT `EmergencyCase_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmergencyCase` ADD CONSTRAINT `EmergencyCase_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `Doctor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmergencyCase` ADD CONSTRAINT `EmergencyCase_registeredById_fkey` FOREIGN KEY (`registeredById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
