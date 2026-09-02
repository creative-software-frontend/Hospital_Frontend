-- CreateTable
CREATE TABLE `PatientSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `patientIdPrefix` VARCHAR(191) NOT NULL DEFAULT 'PT-',
    `autoGenerateId` BOOLEAN NOT NULL DEFAULT true,
    `defaultPatientType` VARCHAR(191) NOT NULL DEFAULT 'NEW',
    `requireGuardian` VARCHAR(191) NOT NULL DEFAULT 'MINORS_ONLY',
    `duplicateDetection` BOOLEAN NOT NULL DEFAULT true,
    `phoneRequired` BOOLEAN NOT NULL DEFAULT true,
    `emailRequired` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PatientSetting_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PatientSetting` ADD CONSTRAINT `PatientSetting_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
