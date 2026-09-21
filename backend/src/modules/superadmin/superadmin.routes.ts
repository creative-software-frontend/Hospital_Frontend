import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import * as superAdminController from "./superadmin.controller";

const router = Router();

router.use(requireAuth);

// SUPER_ADMIN-only real dashboard statistics (role check lives in the service).
router.get("/stats", superAdminController.getDashboardStats);

export default router;