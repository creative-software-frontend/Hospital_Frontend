import { asyncHandler } from "../../utils/asyncHandler";
import { success, created } from "../../utils/apiResponse";
import * as ipdService from "./ipd.service";

export const createAdmission = asyncHandler(async (req, res) => {
  const result = await ipdService.createAdmission(req.user!, req.body);
  return created(res, result);
});

export const listAdmissions = asyncHandler(async (req, res) => {
  const result = await ipdService.listAdmissions(req.user!, req.query as never);
  return success(res, result);
});

export const dischargeAdmission = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = await ipdService.dischargeAdmission(req.user!, id, req.body);
  return success(res, result);
});

export const transferBed = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = await ipdService.transferBed(req.user!, id, req.body);
  return success(res, result);
});

export const getIpdFeeConfig = asyncHandler(async (req, res) => {
  const result = await ipdService.getIpdFeeConfig(req.user!);
  return success(res, result);
});
