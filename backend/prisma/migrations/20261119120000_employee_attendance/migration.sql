-- PURPOSE: Add EmployeeAttendance table (mirrors DoctorAttendance) for HR Attendance Management.
-- PRECONDITION: Employee model exists; branch exists.
-- POST-CHECK: SHOW TABLES LIKE 'employeeattendance'; DESCRIBE employeeattendance;
-- ROLLBACK: DROP TABLE `EmployeeAttendance`;

CREATE TABLE `EmployeeAttendance` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `branchId` INT NOT NULL,
  `employeeId` INT NOT NULL,
  `date` DATE NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PRESENT',
  `checkInTime` VARCHAR(191) NULL,
  `checkOutTime` VARCHAR(191) NULL,
  `notes` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `EmployeeAttendance_branchId_employeeId_date_key` (`branchId`, `employeeId`, `date`),
  KEY `EmployeeAttendance_branchId_idx` (`branchId`),
  KEY `EmployeeAttendance_employeeId_idx` (`employeeId`),
  KEY `EmployeeAttendance_date_idx` (`date`),
  CONSTRAINT `EmployeeAttendance_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `EmployeeAttendance_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
