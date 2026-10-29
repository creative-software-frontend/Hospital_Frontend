import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { created } from "../../utils/apiResponse";
import * as emergencyService from "./emergency.service";
import type { ListEmergencyCasesQuery } from "./emergency.validation";

/**
 * POST /api/emergency/cases
 * Fast intake: patient + triage case in one call.
 */
export const registerEmergencyCase = asyncHandler(async (req: Request, res: Response) => {
  const result = await emergencyService.registerEmergencyCase(req.user!, req.body);
  return created(res, result);
});

/**
 * GET /api/emergency/cases
 * Paginated arrivals for one day, plus the whole-day summary the tiles show.
 */
export const listEmergencyCases = asyncHandler(async (req: Request, res: Response) => {
  const query = (req.validatedQuery ?? {}) as ListEmergencyCasesQuery;
  const result = await emergencyService.listEmergencyCases(req.user!, query);
  // `success` + siblings rather than the `list()` helper: the queue also
  // returns the day summary next to the page of rows.
  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
    summary: result.summary,
  });
});
