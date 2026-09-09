-- CreateTable
CREATE TABLE `InventorySetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `trackMedicalEquipment` BOOLEAN NOT NULL DEFAULT true,
    `assetBarcode` BOOLEAN NOT NULL DEFAULT true,
    `lowStockAlert` BOOLEAN NOT NULL DEFAULT true,
    `autoReorder` BOOLEAN NOT NULL DEFAULT true,
    `stockTransferApproval` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',

    INDEX `InventorySetting_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InventorySetting` ADD CONSTRAINT `InventorySetting_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
