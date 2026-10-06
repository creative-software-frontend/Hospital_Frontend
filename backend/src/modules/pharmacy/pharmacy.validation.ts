import { z } from "zod";

export const createMedicineSchema = z.object({
  genericName: z.string().min(1, "Generic name is required"),
  brandName: z.string().optional(),
  medicineCode: z.string().min(1, "Medicine code is required"),
  barcode: z.string().optional(),
  manufacturer: z.string().optional(),
  categoryId: z.number().int().positive().optional(),
  unitId: z.number().int().positive().optional(),
  reorderLevel: z.number().int().min(0).default(10),
});
export type CreateMedicineInput = z.infer<typeof createMedicineSchema>;

export const updateMedicineSchema = createMedicineSchema.partial();
export type UpdateMedicineInput = z.infer<typeof updateMedicineSchema>;

export const createBatchSchema = z.object({
  medicineId: z.number().int().positive(),
  batchNo: z.string().min(1, "Batch number is required"),
  purchasePrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  quantity: z.number().int().positive("Initial quantity must be positive"),
  expiryDate: z.string().datetime("Expiry date must be ISO string"),
});
export type CreateBatchInput = z.infer<typeof createBatchSchema>;

export const dispenseMedicineSchema = z.object({
  patientId: z.number().int().positive("Patient ID is required"),
  medicineId: z.number().int().positive("Medicine ID is required"),
  batchId: z.number().int().positive("Batch ID is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  discountPercent: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});
export type DispenseMedicineInput = z.infer<typeof dispenseMedicineSchema>;

export const adjustStockSchema = z.object({
  batchId: z.number().int().positive(),
  quantityChange: z.number().int().refine((val) => val !== 0, "Quantity change cannot be 0"),
  notes: z.string().min(1, "Adjustment reason notes are required"),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const listMedicinesQuerySchema = z.object({
  search: z.string().optional(),
  lowStockOnly: z.string().transform((v) => v === "true").optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default("20"),
});
export type ListMedicinesQuery = z.infer<typeof listMedicinesQuerySchema>;
