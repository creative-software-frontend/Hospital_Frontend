import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success, created, list } from "../../utils/apiResponse";
import * as bedWardService from "./bedWard.service";
import type { BedWardKind } from "./bedWard.registry";
import type { ListBedWardQuery } from "./bedWard.validation";

export const listBedWard = asyncHandler(async (req: Request, res: Response) => {
  const result = await bedWardService.listBedWard(
    req.user!,
    req.params.kind as BedWardKind,
    req.validatedQuery as ListBedWardQuery,
  );
  list(res, result.data, result.pagination);
});

export const getBedWard = asyncHandler(async (req: Request, res: Response) => {
  const item = await bedWardService.getBedWard(
    req.user!,
    req.params.kind as BedWardKind,
    Number(req.params.id),
  );
  success(res, { item });
});

export const createBedWard = asyncHandler(async (req: Request, res: Response) => {
  const item = await bedWardService.createBedWard(req.user!, req.params.kind as BedWardKind, req.body);
  created(res, { item });
});

export const updateBedWard = asyncHandler(async (req: Request, res: Response) => {
  const item = await bedWardService.updateBedWard(
    req.user!,
    req.params.kind as BedWardKind,
    Number(req.params.id),
    req.body,
  );
  success(res, { item });
});
