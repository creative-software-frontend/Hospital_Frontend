import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

/**
 * GET /api/health
 * Reports that the API is running. Optionally checks DB connectivity without
 * exposing any sensitive database information.
 */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    let database: "up" | "down" = "up";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "down";
    }

    res.status(200).json({
      success: true,
      message: "Hospital Management API is running",
      data: {
        status: "ok",
        database,
      },
    });
  }),
);

export default router;
