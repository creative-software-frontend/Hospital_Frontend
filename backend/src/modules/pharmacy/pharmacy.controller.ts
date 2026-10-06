import { asyncHandler } from "../../utils/asyncHandler";
import { success, created } from "../../utils/apiResponse";
import * as pharmacyService from "./pharmacy.service";

export const createMedicine = asyncHandler(async (req, res) => {
  const result = await pharmacyService.createMedicine(req.user!, req.body);
  return created(res, result);
});

export const listMedicines = asyncHandler(async (req, res) => {
  const result = await pharmacyService.listMedicines(req.user!, req.query as never);
  return success(res, result);
});

export const createBatch = asyncHandler(async (req, res) => {
  const result = await pharmacyService.createBatch(req.user!, req.body);
  return created(res, result);
});

export const listBatches = asyncHandler(async (req, res) => {
  const medicineId = parseInt(req.params.medicineId, 10);
  const result = await pharmacyService.listBatches(req.user!, medicineId);
  return success(res, result);
});

export const dispenseMedicine = asyncHandler(async (req, res) => {
  const result = await pharmacyService.dispenseMedicine(req.user!, req.body);
  return created(res, result);
});

export const adjustStock = asyncHandler(async (req, res) => {
  const result = await pharmacyService.adjustStock(req.user!, req.body);
  return success(res, result);
});

export const getPharmacyConfig = asyncHandler(async (req, res) => {
  const result = await pharmacyService.getPharmacyConfig(req.user!);
  return success(res, result);
});
