import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success, created, list } from "../../utils/apiResponse";
import * as departmentService from "./department.service";

export const listDepartments = asyncHandler(async (req: Request, res: Response) => {
  const result = await departmentService.listDepartments(req.user!, req.query as never);
  list(res, result.data, result.pagination);
});

export const getDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentService.getDepartment(req.user!, Number(req.params.id));
  success(res, { department });
});

export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentService.createDepartment(req.user!, req.body);
  created(res, { department });
});

export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentService.updateDepartment(req.user!, Number(req.params.id), req.body);
  success(res, { department });
});