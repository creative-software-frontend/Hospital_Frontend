import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success, created, list } from "../../utils/apiResponse";
import * as employeeService from "./employee.service";

export const listReferences = asyncHandler(async (_req: Request, res: Response) => {
  const references = await employeeService.listEmployeeReferences();
  success(res, references);
});

export const nextCode = asyncHandler(async (req: Request, res: Response) => {
  const code = await employeeService.peekNextEmployeeCode(req.user!);
  success(res, { code });
});

export const listEmployees = asyncHandler(async (req: Request, res: Response) => {
  const result = await employeeService.listEmployees(req.user!, req.query as never);
  list(res, result.data, result.pagination);
});

export const getEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.getEmployee(req.user!, Number(req.params.id));
  success(res, { employee });
});

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.createEmployee(req.user!, req.body);
  created(res, { employee });
});

export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.updateEmployee(req.user!, Number(req.params.id), req.body);
  success(res, { employee });
});
