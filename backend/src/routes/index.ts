import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/users/user.routes";
import roleRoutes from "../modules/roles/role.routes";
import permissionRoutes from "../modules/permissions/permission.routes";
import patientRoutes from "../modules/patients/patient.routes";
import branchRoutes from "../modules/branches/branch.routes";
import settingsRoutes from "../modules/settings/setting.routes";
import departmentRoutes from "../modules/departments/department.routes";
import doctorRoutes from "../modules/doctors/doctor.routes";
import serviceRoutes from "../modules/services/service.routes";

const router = Router();

// Aggregate all API routes here as modules are added.
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/permissions", permissionRoutes);
router.use("/patients", patientRoutes);
router.use("/branches", branchRoutes);
router.use("/settings", settingsRoutes);
router.use("/departments", departmentRoutes);
router.use("/doctors", doctorRoutes);
router.use("/services", serviceRoutes);

export default router;
