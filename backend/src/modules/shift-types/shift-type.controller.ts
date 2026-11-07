import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { created, success } from "../../utils/apiResponse";
import * as shiftTypeService from "./shift-type.service";

export const listShiftTypes = asyncHandler(async (req: Request, res: Response) => {
  const shiftTypes = await shiftTypeService.listShiftTypes(req.query as never);
  success(res, { shiftTypes });
});

export const getShiftType = asyncHandler(async (req: Request, res: Response) => {
  const shiftType = await shiftTypeService.getShiftType(Number(req.params.id));
  success(res, { shiftType });
});

export const createShiftType = asyncHandler(async (req: Request, res: Response) => {
  const shiftType = await shiftTypeService.createShiftType(req.body);
  created(res, { shiftType });
});

export const updateShiftType = asyncHandler(async (req: Request, res: Response) => {
  const shiftType = await shiftTypeService.updateShiftType(Number(req.params.id), req.body);
  success(res, { shiftType });
});
