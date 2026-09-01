import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/users/user.routes";
import roleRoutes from "../modules/roles/role.routes";
import permissionRoutes from "../modules/permissions/permission.routes";
import patientRoutes from "../modules/patients/patient.routes";

const router = Router();

// Aggregate all API routes here as modules are added.
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/permissions", permissionRoutes);
router.use("/patients", patientRoutes);

export default router;
