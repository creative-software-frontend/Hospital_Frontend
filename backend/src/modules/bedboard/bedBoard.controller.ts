import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import * as bedBoardService from "./bedBoard.service";

export const getBedBoard = asyncHandler(async (req: Request, res: Response) => {
  const query = (req.validatedQuery ?? {}) as { branchId?: number };
  const board = await bedBoardService.getBedBoard(req.user!, query.branchId);
  success(res, { board });
});
