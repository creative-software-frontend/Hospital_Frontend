import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { created, success } from "../../utils/apiResponse";
import * as service from "./employee-evaluation.service";
import {
  createEmployeeEvaluationSchema,
  employeeEvaluationIdParamSchema,
  listEmployeeEvaluationsQuerySchema,
  updateEmployeeEvaluationSchema,
} from "./employee-evaluation.validation";

export const listEmployeeEvaluations = asyncHandler(async (req: Request, res: Response) => {
  const query = listEmployeeEvaluationsQuerySchema.parse(req.query);
  const result = await service.listEmployeeEvaluations(req.user!, query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const getEmployeeEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = employeeEvaluationIdParamSchema.parse(req.params);
  const result = await service.getEmployeeEvaluation(req.user!, id);
  res.json({ success: true, data: result });
});

export const createEmployeeEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const input = createEmployeeEvaluationSchema.parse(req.body);
  const result = await service.createEmployeeEvaluation(req.user!, input);
  res.status(201).json({ success: true, data: result });
});

export const updateEmployeeEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = employeeEvaluationIdParamSchema.parse(req.params);
  const input = updateEmployeeEvaluationSchema.parse(req.body);
  const result = await service.updateEmployeeEvaluation(req.user!, id, input);
  res.json({ success: true, data: result });
});

export const deleteEmployeeEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = employeeEvaluationIdParamSchema.parse(req.params);
  await service.deleteEmployeeEvaluation(req.user!, id);
  res.json({ success: true, message: "Deleted" });
});
