-- CreateTable
CREATE TABLE `HrSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `payrollCycle` VARCHAR(191) NOT NULL DEFAULT 'monthly',
    `salaryDisbursementDay` INTEGER NOT NULL DEFAULT 1,
    `annualLeaveDays` INTEGER NOT NULL DEFAULT 18,
    `overtimeRate` DECIMAL(3, 2) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',

    INDEX `HrSetting_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HrSetting` ADD CONSTRAINT `HrSetting_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
