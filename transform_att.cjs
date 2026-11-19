const fs = require("fs");
const src = fs.readFileSync("backend/src/modules/doctor-attendances/doctor-attendance.service.ts", "utf8");
let out = src;
// Type imports
out = out.replace(/ListDoctorAttendancesQuery/g, "ListEmployeeAttendancesQuery");
out = out.replace(/CreateDoctorAttendanceInput/g, "CreateEmployeeAttendanceInput");
out = out.replace(/UpdateDoctorAttendanceInput/g, "UpdateEmployeeAttendanceInput");
out = out.replace(/BulkDoctorAttendanceInput/g, "BulkEmployeeAttendanceInput");
// Function names
out = out.replace(/listDoctorAttendances/g, "listEmployeeAttendances");
out = out.replace(/getDoctorAttendance/g, "getEmployeeAttendance");
out = out.replace(/createDoctorAttendance/g, "createEmployeeAttendance");
out = out.replace(/updateDoctorAttendance/g, "updateEmployeeAttendance");
out = out.replace(/deleteDoctorAttendance/g, "deleteEmployeeAttendance");
out = out.replace(/bulkDoctorAttendance/g, "bulkEmployeeAttendance");
out = out.replace(/getAttendanceForDate/g, "getEmployeeAttendanceForDate");
// Model references
out = out.replace(/prisma\.doctorAttendance/g, "prisma.employeeAttendance");
out = out.replace(/prisma\.doctor\b/g, "prisma.employee");
out = out.replace(/DoctorAttendance/g, "EmployeeAttendance");
// field names: doctorId -> employeeId
out = out.replace(/doctorId/g, "employeeId");
// permission module: "doctor" -> "employee" (in requirePermission calls inside service? service doesn't call requirePermission; it's in routes. But service may reference "doctor" in error messages)
out = out.replace(/Doctor not found/g, "Employee not found");
out = out.replace(/doctor not found/gi, "employee not found");
// variable names doctor -> employee (careful: might break other things, but let's try)
out = out.replace(/\bdoctor\b/g, "employee");
out = out.replace(/\bDoctor\b/g, "Employee");
// Fix the import path for types
out = out.replace(/from "\.\/doctor-attendance\.validation"/g, 'from "./employee-attendance.validation"');
fs.writeFileSync("backend/src/modules/employee-attendances/employee-attendance.service.ts", out);
console.log("written");
