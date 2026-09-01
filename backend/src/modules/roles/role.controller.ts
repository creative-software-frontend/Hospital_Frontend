import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as roleService from "./role.service";

export const listRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await roleService.listRoles({});
  res.status(200).json({ success: true, data: { roles } });
});

export const getRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await roleService.getRole(Number(req.params.id));
  res.status(200).json({ success: true, data: { role } });
});
