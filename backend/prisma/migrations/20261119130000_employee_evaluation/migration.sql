-- PURPOSE: Add EmployeeEvaluation table for HR Employee Evaluation.
-- PRECONDITION: Employee and Branch models exist.
-- POST-CHECK: SHOW TABLES LIKE 'employeeevaluation'; DESCRIBE employeeevaluation;
-- ROLLBACK: DROP TABLE `EmployeeEvaluation`;

CREATE TABLE `EmployeeEvaluation` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `branchId` INT NOT NULL,
  `employeeId` INT NOT NULL,
  `evaluatorId` INT NULL,
  `date` DATE NOT NULL,
  `rating` INT NOT NULL DEFAULT 0,
  `comments` VARCHAR(1000) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  KEY `EmployeeEvaluation_branchId_idx` (`branchId`),
  KEY `EmployeeEvaluation_employeeId_idx` (`employeeId`),
  KEY `EmployeeEvaluation_date_idx` (`date`),
  CONSTRAINT `EmployeeEvaluation_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `EmployeeEvaluation_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `EmployeeEvaluation_evaluatorId_fkey` FOREIGN KEY (`evaluatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
