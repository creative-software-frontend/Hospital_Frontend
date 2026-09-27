import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success, created, list } from "../../utils/apiResponse";
import * as nurseService from "./nurse.service";

export const listShiftTypes = asyncHandler(async (_req: Request, res: Response) => {
  const shiftTypes = await nurseService.listShiftTypes();
  success(res, { shiftTypes });
});

export const listNurses = asyncHandler(async (req: Request, res: Response) => {
  const result = await nurseService.listNurses(req.user!, req.query as never);
  list(res, result.data, result.pagination);
});

export const getNurse = asyncHandler(async (req: Request, res: Response) => {
  const nurse = await nurseService.getNurse(req.user!, Number(req.params.id));
  success(res, { nurse });
});

export const createNurse = asyncHandler(async (req: Request, res: Response) => {
  const nurse = await nurseService.createNurse(req.user!, req.body);
  created(res, { nurse });
});

export const updateNurse = asyncHandler(async (req: Request, res: Response) => {
  const nurse = await nurseService.updateNurse(req.user!, Number(req.params.id), req.body);
  success(res, { nurse });
});
