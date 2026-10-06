import { asyncHandler } from "../../utils/asyncHandler";
import { success, created } from "../../utils/apiResponse";
import * as opdService from "./opd.service";

export const createOpdAppointment = asyncHandler(async (req, res) => {
  const result = await opdService.createOpdAppointment(req.user!, req.body);
  return created(res, result);
});

export const listOpdAppointments = asyncHandler(async (req, res) => {
  const result = await opdService.listOpdAppointments(req.user!, req.query as never);
  return success(res, result);
});

export const updateOpdAppointmentStatus = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = await opdService.updateOpdAppointmentStatus(req.user!, id, req.body);
  return success(res, result);
});

export const createOpdVisit = asyncHandler(async (req, res) => {
  const result = await opdService.createOpdVisit(req.user!, req.body);
  return created(res, result);
});

export const getOpdFeeConfig = asyncHandler(async (req, res) => {
  const result = await opdService.getOpdFeeConfig(req.user!);
  return success(res, result);
});
