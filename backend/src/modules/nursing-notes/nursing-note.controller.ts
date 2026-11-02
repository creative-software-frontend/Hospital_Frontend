import { Request, Response } from "express";
import * as service from "./nursing-note.service";
import { created, list, success } from "../../utils/apiResponse";

export async function listNursingNotes(req: Request, res: Response) {
  const result = await service.listNursingNotes(req.user!, req.validatedQuery as never);
  return list(res, result.data, result.pagination);
}
export async function getNursingNote(req: Request, res: Response) {
  return success(res, await service.getNursingNote(req.user!, Number(req.params.id)));
}
export async function createNursingNote(req: Request, res: Response) {
  return created(res, await service.createNursingNote(req.user!, req.body));
}
export async function updateNursingNote(req: Request, res: Response) {
  return success(res, await service.updateNursingNote(req.user!, Number(req.params.id), req.body));
}
export async function deleteNursingNote(req: Request, res: Response) {
  await service.deleteNursingNote(req.user!, Number(req.params.id));
  return success(res, { message: "Nursing note deleted" });
}
