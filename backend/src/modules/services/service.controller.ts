import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success, created, list } from "../../utils/apiResponse";
import * as serviceService from "./service.service";

export const listServices = asyncHandler(async (req: Request, res: Response) => {
  const result = await serviceService.listServices(req.user!, req.query as never);
  list(res, result.data, result.pagination);
});

export const getService = asyncHandler(async (req: Request, res: Response) => {
  const service = await serviceService.getService(req.user!, Number(req.params.id));
  success(res, { service });
});

export const createService = asyncHandler(async (req: Request, res: Response) => {
  const service = await serviceService.createService(req.user!, req.body);
  created(res, { service });
});

export const updateService = asyncHandler(async (req: Request, res: Response) => {
  const service = await serviceService.updateService(req.user!, Number(req.params.id), req.body);
  success(res, { service });
});

export const listServiceCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await serviceService.listServiceCategories();
  success(res, { categories });
});