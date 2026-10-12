-- Bed & Ward setup rework:
--   * Floor/BedType/BedGroup/BedStatus drop their `code` (and list-only
--     `description` on BedType/BedStatus). The lists are name-only now.
--   * BedGroup gains a required `floorId` (FK to Floor) and an optional `color`.
--   * New `BedDefinition` table = the "Bed" list (name + bed type + bed group +
--     not-available-for-use flag). Named BedDefinition because the schema's
--     pre-existing `Bed` model (room-based, used by IPD/Admissions) keeps that
--     name.
-- All affected tables are empty, so the NOT NULL `floorId` needs no backfill.

-- AlterTable Floor
DROP INDEX `Floor_branchId_code_key` ON `Floor`;
ALTER TABLE `Floor` DROP COLUMN `code`;

-- AlterTable BedType
DROP INDEX `BedType_branchId_code_key` ON `BedType`;
ALTER TABLE `BedType` DROP COLUMN `code`,
    DROP COLUMN `description`;

-- AlterTable BedGroup
DROP INDEX `BedGroup_branchId_code_key` ON `BedGroup`;
ALTER TABLE `BedGroup` DROP COLUMN `code`;
ALTER TABLE `BedGroup` ADD COLUMN `floorId` INTEGER NOT NULL AFTER `branchId`,
    ADD COLUMN `color` VARCHAR(20) NULL AFTER `name`;
CREATE INDEX `BedGroup_floorId_idx` ON `BedGroup`(`floorId`);

-- AlterTable BedStatus
DROP INDEX `BedStatus_branchId_code_key` ON `BedStatus`;
ALTER TABLE `BedStatus` DROP COLUMN `code`,
    DROP COLUMN `description`;

-- CreateTable BedDefinition
CREATE TABLE `BedDefinition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `bedTypeId` INTEGER NOT NULL,
    `bedGroupId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `notAvailableForUse` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BedDefinition_branchId_idx`(`branchId`),
    INDEX `BedDefinition_bedTypeId_idx`(`bedTypeId`),
    INDEX `BedDefinition_bedGroupId_idx`(`bedGroupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BedGroup` ADD CONSTRAINT `BedGroup_floorId_fkey` FOREIGN KEY (`floorId`) REFERENCES `Floor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `BedDefinition` ADD CONSTRAINT `BedDefinition_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BedDefinition` ADD CONSTRAINT `BedDefinition_bedTypeId_fkey` FOREIGN KEY (`bedTypeId`) REFERENCES `BedType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BedDefinition` ADD CONSTRAINT `BedDefinition_bedGroupId_fkey` FOREIGN KEY (`bedGroupId`) REFERENCES `BedGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
