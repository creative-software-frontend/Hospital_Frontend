import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success, list } from "../../utils/apiResponse";
import * as branchService from "./branch.service";

export const listBranches = asyncHandler(async (req: Request, res: Response) => {
  const result = await branchService.listBranches(req.user!, req.query as never);
  list(res, result.data, result.pagination);
});

export const getBranch = asyncHandler(async (req: Request, res: Response) => {
  const branch = await branchService.getBranch(req.user!, Number(req.params.id));
  success(res, { branch });
});

export const createBranch = asyncHandler(async (req: Request, res: Response) => {
  const branch = await branchService.createBranch(req.user!, req.body);
  success(res, { branch }, 201);
});

export const updateBranch = asyncHandler(async (req: Request, res: Response) => {
  const branch = await branchService.updateBranch(req.user!, Number(req.params.id), req.body);
  success(res, { branch });
});