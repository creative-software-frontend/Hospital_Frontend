import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import type { Request, Response } from "express";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/permissions
 * Grouped list of all permissions, optionally filtered by module.
 */
router.get(
  "/",
  requirePermission("role", "read"),
  asyncHandler(async (req: Request, res: Response) => {
    const requestedModule = typeof req.query.module === "string" ? req.query.module : undefined;

    const perms = await prisma.permission.findMany({
      where: requestedModule ? { module: requestedModule } : undefined,
      select: { module: true, action: true, description: true },
      orderBy: [{ module: "asc" }, { action: "asc" }],
    });

    // Group by module for convenient consumption
    const grouped = perms.reduce<Record<string, { module: string; actions: { action: string; description: string | null }[] }>>(
      (acc, p) => {
        if (!acc[p.module]) acc[p.module] = { module: p.module, actions: [] };
        acc[p.module].actions.push({ action: p.action, description: p.description });
        return acc;
      },
      {},
    );

    res.status(200).json({ success: true, data: { modules: Object.values(grouped) } });
  }),
);

export default router;
