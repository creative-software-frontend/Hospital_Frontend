CREATE TABLE `Chamber` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `branchId` INTEGER NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `location` VARCHAR(191) NULL,
  `description` VARCHAR(500) NULL,
  `doctorId` INTEGER NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Chamber_branchId_code_key` (`branchId`, `code`),
  INDEX `Chamber_branchId_idx` (`branchId`),
  INDEX `Chamber_doctorId_idx` (`doctorId`),
  CONSTRAINT `Chamber_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Chamber_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `Doctor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
