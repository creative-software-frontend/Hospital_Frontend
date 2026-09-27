-- CreateTable
CREATE TABLE `Nurse` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `branchId` INTEGER NOT NULL,
    `departmentId` INTEGER NULL,
    `shiftTypeId` INTEGER NULL,
    `nurseCode` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `qualification` VARCHAR(191) NULL,
    `registrationNo` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `deletedAt` DATETIME(3) NULL,
    `createdById` INTEGER NULL,
    `updatedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Nurse_userId_key`(`userId`),
    INDEX `Nurse_branchId_idx`(`branchId`),
    INDEX `Nurse_registrationNo_idx`(`registrationNo`),
    INDEX `Nurse_deletedAt_idx`(`deletedAt`),
    INDEX `Nurse_departmentId_idx`(`departmentId`),
    UNIQUE INDEX `Nurse_branchId_nurseCode_key`(`branchId`, `nurseCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Nurse` ADD CONSTRAINT `Nurse_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Nurse` ADD CONSTRAINT `Nurse_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Nurse` ADD CONSTRAINT `Nurse_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Nurse` ADD CONSTRAINT `Nurse_shiftTypeId_fkey` FOREIGN KEY (`shiftTypeId`) REFERENCES `ShiftType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
