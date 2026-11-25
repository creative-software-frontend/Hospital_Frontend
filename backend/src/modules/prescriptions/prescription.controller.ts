import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { created, list, success } from "../../utils/apiResponse";
import * as service from "./prescription.service";

export const listPrescriptions = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listPrescriptions(req.user!, req.validatedQuery as never);
  list(res, result.data, result.pagination);
});

export const getPrescription = asyncHandler(async (req: Request, res: Response) => {
  success(res, await service.getPrescription(req.user!, Number(req.params.id)));
});

export const createPrescription = asyncHandler(async (req: Request, res: Response) => {
  created(res, await service.createPrescription(req.user!, req.body));
});

export const updatePrescription = asyncHandler(async (req: Request, res: Response) => {
  success(res, await service.updatePrescription(req.user!, Number(req.params.id), req.body));
});

export const cancelPrescription = asyncHandler(async (req: Request, res: Response) => {
  success(res, await service.cancelPrescription(req.user!, Number(req.params.id)));
});
