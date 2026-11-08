CREATE UNIQUE INDEX `DoctorSchedule_branchId_doctorId_dayOfWeek_key`
    ON `DoctorSchedule`(`branchId`, `doctorId`, `dayOfWeek`);
