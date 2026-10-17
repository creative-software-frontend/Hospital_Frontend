-- Employees get their own login role (linked User account created with each
-- Employee record). Append the new value to the existing MySQL enum so all
-- current rows stay valid.

ALTER TABLE `Role`
  MODIFY `seederKey` ENUM('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'PHARMACIST', 'PATHOLOGIST', 'RADIOLOGIST', 'ACCOUNTANT', 'RECEPTIONIST', 'NURSE', 'EMPLOYEE') NOT NULL;
