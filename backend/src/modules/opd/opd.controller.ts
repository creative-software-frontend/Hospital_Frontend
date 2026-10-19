import { asyncHandler } from "../../utils/asyncHandler";
import { success, created, list } from "../../utils/apiResponse";
import * as opdService from "./opd.service";
import type { ListOpdAppointmentsQuery } from "./opd.validation";

export const createOpdAppointment = asyncHandler(async (req, res) => {
  const result = await opdService.createOpdAppointment(req.user!, req.body);
  return created(res, result);
});

// The list schema coerces `doctorId`/`patientId`/`page`/`limit` from the raw
// query-string, so the parsed values live on `req.validatedQuery` — reading
// `req.query` here would hand Prisma strings for the numeric filters.
export const listOpdAppointments = asyncHandler(async (req, res) => {
  const query = (req.validatedQuery ?? {}) as ListOpdAppointmentsQuery;
  const result = await opdService.listOpdAppointments(req.user!, query);
  return list(res, result.data, result.pagination);
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
