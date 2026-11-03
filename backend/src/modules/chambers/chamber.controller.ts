import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as chamberService from "./chamber.service";
import { success, list, created } from "../../utils/apiResponse";

export const listChambers = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const result = await chamberService.listChambers(actor, req.query as never);
  list(res, result.data, result.pagination);
});

export const getChamber = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const row = await chamberService.getChamber(actor, Number(req.params.id));
  success(res, row);
});

export const createChamber = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const row = await chamberService.createChamber(actor, req.body);
  created(res, row);
});

export const updateChamber = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const row = await chamberService.updateChamber(actor, Number(req.params.id), req.body);
  success(res, row);
});

export const deleteChamber = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  await chamberService.deleteChamber(actor, Number(req.params.id));
  success(res, { message: "Chamber deleted" });
});

export const listChamberSchedules = asyncHandler(async (req: Request, res: Response) => {
  const rows = await chamberService.listChamberSchedules(req.user!, Number(req.params.id));
  success(res, rows);
});

export const replaceChamberSchedules = asyncHandler(async (req: Request, res: Response) => {
  const rows = await chamberService.replaceChamberSchedules(req.user!, Number(req.params.id), req.body);
  success(res, rows);
});
