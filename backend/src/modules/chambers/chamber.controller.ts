import { Request, Response } from "express";
import * as chamberService from "./chamber.service";
import { success, list, created } from "../../utils/apiResponse";

export async function listChambers(req: Request, res: Response) {
  const actor = req.user!;
  const result = await chamberService.listChambers(actor, req.query as never);
  return list(res, result.data, result.pagination);
}

export async function getChamber(req: Request, res: Response) {
  const actor = req.user!;
  const row = await chamberService.getChamber(actor, Number(req.params.id));
  return success(res, row);
}

export async function createChamber(req: Request, res: Response) {
  const actor = req.user!;
  const row = await chamberService.createChamber(actor, req.body);
  return created(res, row);
}

export async function updateChamber(req: Request, res: Response) {
  const actor = req.user!;
  const row = await chamberService.updateChamber(actor, Number(req.params.id), req.body);
  return success(res, row);
}

export async function deleteChamber(req: Request, res: Response) {
  const actor = req.user!;
  await chamberService.deleteChamber(actor, Number(req.params.id));
  return success(res, { message: "Chamber deleted" });
}
