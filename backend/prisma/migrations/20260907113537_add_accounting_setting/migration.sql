-- CreateTable
CREATE TABLE `AccountingSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `fiscalYear` VARCHAR(191) NOT NULL DEFAULT 'July 2025 - June 2026',
    `baseCurrency` VARCHAR(191) NOT NULL DEFAULT 'BDT',
    `chartOfAccounts` VARCHAR(191) NOT NULL DEFAULT 'Hospital Standard',
    `autoPostToLedger` BOOLEAN NOT NULL DEFAULT true,
    `trialBalanceFrequency` VARCHAR(191) NOT NULL DEFAULT 'monthly',
    `voucherEnabled` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',

    INDEX `AccountingSetting_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AccountingSetting` ADD CONSTRAINT `AccountingSetting_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
