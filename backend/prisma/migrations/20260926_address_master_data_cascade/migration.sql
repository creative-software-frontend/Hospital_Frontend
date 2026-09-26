-- DropIndex
DROP INDEX `MasterData_branchId_category_label_key` ON `masterdata`;
-- AlterTable
ALTER TABLE `masterdata` ADD COLUMN `parentCode` VARCHAR(191) NULL;
-- AlterTable
ALTER TABLE `patient` ADD COLUMN `division` VARCHAR(191) NULL,
    ADD COLUMN `thana` VARCHAR(191) NULL,
    ADD COLUMN `upazila` VARCHAR(191) NULL,
    ADD COLUMN `whatsapp` VARCHAR(191) NULL;
-- AlterTable
ALTER TABLE `patientsetting` ADD COLUMN `whatsappRequired` BOOLEAN NOT NULL DEFAULT false;
-- CreateIndex
CREATE INDEX `MasterData_category_parentCode_idx` ON `MasterData`(`category`, `parentCode`);
-- CreateIndex
CREATE UNIQUE INDEX `MasterData_branchId_category_parentCode_label_key` ON `MasterData`(`branchId`, `category`, `parentCode`, `label`);
-- CreateIndex
CREATE UNIQUE INDEX `MasterData_branchId_category_code_key` ON `MasterData`(`branchId`, `category`, `code`);
