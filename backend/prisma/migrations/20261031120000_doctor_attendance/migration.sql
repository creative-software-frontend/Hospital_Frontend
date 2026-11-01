CREATE TABLE `DoctorAttendance` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `branchId` INTEGER NOT NULL,
  `doctorId` INTEGER NOT NULL,
  `date` DATE NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PRESENT',
  `checkInTime` VARCHAR(191) NULL,
  `checkOutTime` VARCHAR(191) NULL,
  `notes` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DoctorAttendance_branchId_doctorId_date_key` (`branchId`, `doctorId`, `date`),
  INDEX `DoctorAttendance_branchId_idx` (`branchId`),
  INDEX `DoctorAttendance_doctorId_idx` (`doctorId`),
  INDEX `DoctorAttendance_date_idx` (`date`),
  CONSTRAINT `DoctorAttendance_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `DoctorAttendance_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `Doctor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
