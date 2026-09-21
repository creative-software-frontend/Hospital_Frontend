import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import * as superAdminService from "./superadmin.service";

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await superAdminService.getDashboardStats(req.user!);
  success(res, { stats });
});