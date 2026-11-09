import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./bed-transfer.service";
import { created, success } from "../../utils/apiResponse";

export const listBedTransfers = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listBedTransfers(req.user!, req.validatedQuery as never);
  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

export const getBedTransfer = asyncHandler(async (req: Request, res: Response) => {
  success(res, await service.getBedTransfer(req.user!, Number(req.params.id)));
});

export const createBedTransfer = asyncHandler(async (req: Request, res: Response) => {
  created(res, await service.createBedTransfer(req.user!, req.body));
});

export const updateBedTransfer = asyncHandler(async (req: Request, res: Response) => {
  success(res, await service.updateBedTransfer(req.user!, Number(req.params.id), req.body));
});

export const deleteBedTransfer = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteBedTransfer(req.user!, Number(req.params.id));
  success(res, { message: "Bed transfer deleted" });
});
