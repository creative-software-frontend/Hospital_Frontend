-- DropForeignKey
ALTER TABLE `masterdata` DROP FOREIGN KEY `MasterData_branchId_fkey`;

-- Replaces the single `masterdata` lookup table with one table per category.
--
-- The address hierarchy becomes Division -> District -> Upazila -> Union with
-- real foreign keys, so the cascade can no longer be broken by a bad parent code.
-- The flat app-owned lookups (cities, areas, visit types, blood groups, document
-- types) each get their own table too. Payment methods are consolidated into the
-- pre-existing global `paymentmethod` model, which was empty while the old
-- `masterdata` copy sat unused beside it.
--
-- This is a clean break: the old `masterdata` rows are dropped rather than copied,
-- so reload them afterwards with `npm run db:seed` and by uploading
-- `sql/address-master-data.sql`. Patient records keep their address text and are
-- untouched by the drop.
--
-- `divisions`, `districts`, `upazilas` and `unions` are leftovers from the
-- original database. No model referenced them (they had no foreign keys and no
-- migration ever created them), so they are dropped here rather than left behind.

-- AlterTable
-- `updatedAt` is given an explicit default so this succeeds on a database whose
-- paymentmethod table already has rows, not just an empty one.
ALTER TABLE `paymentmethod` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `Division` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `bnName` VARCHAR(191) NULL,
    `url` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Division_branchId_idx`(`branchId`),
    UNIQUE INDEX `Division_branchId_code_key`(`branchId`, `code`),
    UNIQUE INDEX `Division_branchId_name_key`(`branchId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `District` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `divisionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `bnName` VARCHAR(191) NULL,
    `lat` DOUBLE NULL,
    `lon` DOUBLE NULL,
    `url` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `District_branchId_idx`(`branchId`),
    INDEX `District_divisionId_idx`(`divisionId`),
    UNIQUE INDEX `District_branchId_code_key`(`branchId`, `code`),
    UNIQUE INDEX `District_branchId_divisionId_name_key`(`branchId`, `divisionId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Upazila` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `districtId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `bnName` VARCHAR(191) NULL,
    `url` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Upazila_branchId_idx`(`branchId`),
    INDEX `Upazila_districtId_idx`(`districtId`),
    UNIQUE INDEX `Upazila_branchId_code_key`(`branchId`, `code`),
    UNIQUE INDEX `Upazila_branchId_districtId_name_key`(`branchId`, `districtId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Union` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `upazilaId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `bnName` VARCHAR(191) NULL,
    `url` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Union_branchId_idx`(`branchId`),
    INDEX `Union_upazilaId_idx`(`upazilaId`),
    UNIQUE INDEX `Union_branchId_code_key`(`branchId`, `code`),
    UNIQUE INDEX `Union_branchId_upazilaId_name_key`(`branchId`, `upazilaId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `City` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `City_branchId_idx`(`branchId`),
    UNIQUE INDEX `City_branchId_code_key`(`branchId`, `code`),
    UNIQUE INDEX `City_branchId_name_key`(`branchId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Area` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Area_branchId_idx`(`branchId`),
    UNIQUE INDEX `Area_branchId_code_key`(`branchId`, `code`),
    UNIQUE INDEX `Area_branchId_name_key`(`branchId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisitType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VisitType_branchId_idx`(`branchId`),
    UNIQUE INDEX `VisitType_branchId_code_key`(`branchId`, `code`),
    UNIQUE INDEX `VisitType_branchId_name_key`(`branchId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BloodGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BloodGroup_branchId_idx`(`branchId`),
    UNIQUE INDEX `BloodGroup_branchId_code_key`(`branchId`, `code`),
    UNIQUE INDEX `BloodGroup_branchId_name_key`(`branchId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DocumentType_branchId_idx`(`branchId`),
    UNIQUE INDEX `DocumentType_branchId_code_key`(`branchId`, `code`),
    UNIQUE INDEX `DocumentType_branchId_name_key`(`branchId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Division` ADD CONSTRAINT `Division_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `District` ADD CONSTRAINT `District_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `District` ADD CONSTRAINT `District_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Upazila` ADD CONSTRAINT `Upazila_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Upazila` ADD CONSTRAINT `Upazila_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `District`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Union` ADD CONSTRAINT `Union_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Union` ADD CONSTRAINT `Union_upazilaId_fkey` FOREIGN KEY (`upazilaId`) REFERENCES `Upazila`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `City` ADD CONSTRAINT `City_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Area` ADD CONSTRAINT `Area_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitType` ADD CONSTRAINT `VisitType_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BloodGroup` ADD CONSTRAINT `BloodGroup_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentType` ADD CONSTRAINT `DocumentType_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropTable
-- Done last on purpose: the new tables above are created before the old
-- masterdata and the leftover address tables are removed, so a failure
-- part-way through leaves the previous data in place rather than neither.
-- DropTable
DROP TABLE `districts`;

-- DropTable
DROP TABLE `divisions`;

-- DropTable
DROP TABLE `masterdata`;

-- DropTable
DROP TABLE `unions`;

-- DropTable
DROP TABLE `upazilas`;

