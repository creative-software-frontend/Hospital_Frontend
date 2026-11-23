import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { created, success } from "../../utils/apiResponse";
import * as leaveTypeService from "./leave-type.service";

export const listLeaveTypes = asyncHandler(async (req: Request, res: Response) => {
  const leaveTypes = await leaveTypeService.listLeaveTypes((req.validatedQuery ?? req.query) as never);
  success(res, { leaveTypes });
});

export const getLeaveType = asyncHandler(async (req: Request, res: Response) => {
  const leaveType = await leaveTypeService.getLeaveType(Number(req.params.id));
  success(res, { leaveType });
});

export const createLeaveType = asyncHandler(async (req: Request, res: Response) => {
  const leaveType = await leaveTypeService.createLeaveType(req.body);
  created(res, { leaveType });
});

export const updateLeaveType = asyncHandler(async (req: Request, res: Response) => {
  const leaveType = await leaveTypeService.updateLeaveType(Number(req.params.id), req.body);
  success(res, { leaveType });
});

export const deleteLeaveType = asyncHandler(async (req: Request, res: Response) => {
  await leaveTypeService.deleteLeaveType(Number(req.params.id));
  success(res, { message: "Deleted" });
});
