-- Configurable option lists for the Digital Prescription pickers.
CREATE TABLE `PrescriptionOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `category` ENUM('ILLNESS', 'DURATION', 'BP', 'TEMPERATURE', 'PULSE', 'RESPIRATION', 'SPO2', 'WEIGHT', 'FREQUENCY', 'INSTRUCTION', 'ADVICE') NOT NULL,
    `label` VARCHAR(255) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PrescriptionOption_branchId_category_label_key`(`branchId`, `category`, `label`),
    INDEX `PrescriptionOption_branchId_category_deletedAt_idx`(`branchId`, `category`, `deletedAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `PrescriptionOption_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
