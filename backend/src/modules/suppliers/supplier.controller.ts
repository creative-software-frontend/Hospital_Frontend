import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success, list, created } from "../../utils/apiResponse";
import type { ListSuppliersQuery } from "./supplier.validation";
import * as supplierService from "./supplier.service";

export const listSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const result = await supplierService.listSuppliers(
    (req.validatedQuery ?? req.query) as ListSuppliersQuery,
  );
  list(res, result.data, result.pagination);
});

export const getSupplier = asyncHandler(async (req: Request, res: Response) => {
  success(res, await supplierService.getSupplier(Number(req.params.id)));
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  created(res, await supplierService.createSupplier(req.user!, req.body));
});

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  success(
    res,
    await supplierService.updateSupplier(req.user!, Number(req.params.id), req.body),
  );
});

export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  const row = await supplierService.deleteSupplier(req.user!, Number(req.params.id));
  success(res, { ...row, message: "Supplier deleted" });
});
