import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
} from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import {
  loadPharmacyConfig,
  loadBillingConfig,
  generateNextInvoiceNumber,
} from "../settings/settingsConfig";
import type { AuthUser } from "../../types/auth";
import type {
  CreateMedicineInput,
  UpdateMedicineInput,
  CreateBatchInput,
  DispenseMedicineInput,
  AdjustStockInput,
  ListMedicinesQuery,
} from "./pharmacy.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

function enforceBranch(actor: AuthUser, branchId: number): void {
  if (!isSuperAdmin(actor) && actor.branchId !== branchId) {
    throw new AuthorizationError("You do not have permission to access this branch");
  }
}

/* ------------------------------------------------------------------ *
 * Medicine Catalog Management
 * ------------------------------------------------------------------ */

export async function createMedicine(actor: AuthUser, input: CreateMedicineInput) {
  const branchId = actor.branchId;

  const existing = await prisma.medicine.findFirst({
    where: { branchId, medicineCode: input.medicineCode, deletedAt: null },
  });
  if (existing) {
    throw new BusinessRuleError(`Medicine code '${input.medicineCode}' already exists in this branch`);
  }

  const medicine = await prisma.medicine.create({
    data: {
      branchId,
      genericName: input.genericName,
      brandName: input.brandName ?? null,
      medicineCode: input.medicineCode,
      barcode: input.barcode ?? null,
      manufacturer: input.manufacturer ?? null,
      categoryId: input.categoryId ?? null,
      unitId: input.unitId ?? null,
      reorderLevel: input.reorderLevel ?? 10,
      createdById: actor.id,
    },
    include: {
      category: true,
      unit: true,
    },
  });

  await writeAuditLog({
    module: "PHARMACY",
    action: "MEDICINE_CREATED",
    tableName: "Medicine",
    recordId: String(medicine.id),
    newValues: {
      medicineCode: medicine.medicineCode,
      genericName: medicine.genericName,
      reorderLevel: medicine.reorderLevel,
    },
    user: actor,
    branchId,
  });

  return medicine;
}

export async function listMedicines(actor: AuthUser, query: ListMedicinesQuery) {
  const branchId = actor.branchId;
  const config = await loadPharmacyConfig(branchId);

  const where: Prisma.MedicineWhereInput = {
    branchId,
    deletedAt: null,
  };

  if (query.search) {
    where.OR = [
      { genericName: { contains: query.search } },
      { brandName: { contains: query.search } },
      { medicineCode: { contains: query.search } },
      { barcode: { contains: query.search } },
    ];
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const [total, medicines] = await Promise.all([
    prisma.medicine.count({ where }),
    prisma.medicine.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { genericName: "asc" },
      include: {
        category: true,
        unit: true,
        batches: {
          where: { status: "active" },
          select: {
            id: true,
            batchNo: true,
            quantity: true,
            expiryDate: true,
            sellingPrice: true,
          },
        },
      },
    }),
  ]);

  // Enhance items with calculated total stock & low-stock status evaluated against settings
  const now = new Date();
  const items = medicines.map((m) => {
    // Available stock from active non-expired batches
    const activeBatches = m.batches.filter(
      (b) => !b.expiryDate || new Date(b.expiryDate) >= now
    );
    const totalStock = activeBatches.reduce((sum, b) => sum + b.quantity, 0);
    const isLowStock = config.lowStockAlert && totalStock <= m.reorderLevel;

    return {
      ...m,
      totalStock,
      isLowStock,
      lowStockAlertEnabled: config.lowStockAlert,
    };
  });

  const filteredItems = query.lowStockOnly ? items.filter((i) => i.isLowStock) : items;

  return {
    data: filteredItems,
    pagination: {
      page,
      limit,
      total: query.lowStockOnly ? filteredItems.length : total,
      pages: Math.ceil((query.lowStockOnly ? filteredItems.length : total) / limit),
    },
    effectiveConfig: config,
  };
}

/* ------------------------------------------------------------------ *
 * Medicine Batch & Stock Inbound
 * ------------------------------------------------------------------ */

export async function createBatch(actor: AuthUser, input: CreateBatchInput) {
  const branchId = actor.branchId;

  const medicine = await prisma.medicine.findFirst({
    where: { id: input.medicineId, branchId, deletedAt: null },
  });
  if (!medicine) {
    throw new NotFoundError(`Medicine with ID ${input.medicineId} not found in this branch`);
  }

  const expiryDate = new Date(input.expiryDate);

  const result = await prisma.$transaction(async (tx) => {
    // Create batch
    const batch = await tx.medicineBatch.create({
      data: {
        branchId,
        medicineId: input.medicineId,
        batchNo: input.batchNo,
        purchasePrice: new Prisma.Decimal(input.purchasePrice),
        sellingPrice: new Prisma.Decimal(input.sellingPrice),
        quantity: input.quantity,
        expiryDate,
        status: "active",
        updatedById: actor.id,
      },
    });

    // Record Stock Movement (PURCHASE)
    const movement = await tx.stockMovement.create({
      data: {
        branchId,
        medicineId: input.medicineId,
        batchId: batch.id,
        movementType: "PURCHASE",
        quantity: input.quantity,
        unitPrice: new Prisma.Decimal(input.purchasePrice),
        referenceNo: `PO-BATCH-${batch.id}`,
        notes: `Inbound batch stock addition: ${input.batchNo}`,
        createdById: actor.id,
      },
    });

    return { batch, movement };
  });

  await writeAuditLog({
    module: "PHARMACY",
    action: "BATCH_CREATED",
    tableName: "MedicineBatch",
    recordId: String(result.batch.id),
    newValues: {
      batchNo: input.batchNo,
      medicineId: input.medicineId,
      quantity: input.quantity,
      sellingPrice: input.sellingPrice,
      expiryDate: input.expiryDate,
    },
    user: actor,
    branchId,
  });

  return result;
}

export async function listBatches(actor: AuthUser, medicineId: number) {
  const branchId = actor.branchId;
  const config = await loadPharmacyConfig(branchId);

  const batches = await prisma.medicineBatch.findMany({
    where: { medicineId, branchId },
    orderBy: { expiryDate: "asc" },
  });

  const now = new Date();
  const alertThreshold = new Date(now.getTime() + config.expiryAlertDays * 86400000);

  return batches.map((b) => {
    const exp = b.expiryDate ? new Date(b.expiryDate) : null;
    const isExpired = exp ? exp < now : false;
    const isExpiringSoon = exp ? exp >= now && exp <= alertThreshold : false;

    return {
      ...b,
      isExpired,
      isExpiringSoon,
      expiryAlertDays: config.expiryAlertDays,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Pharmacy Dispensing (Core Business Logic + Concurrency + Billing)
 * ------------------------------------------------------------------ */

export async function dispenseMedicine(actor: AuthUser, input: DispenseMedicineInput) {
  const branchId = actor.branchId;

  // 1. Verify patient exists in branch
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, branchId, deletedAt: null },
    select: { id: true, patientCode: true, name: true },
  });
  if (!patient) {
    throw new NotFoundError("Patient not found in this branch");
  }

  // 2. Fetch Medicine and Batch
  const batch = await prisma.medicineBatch.findFirst({
    where: { id: input.batchId, medicineId: input.medicineId, branchId },
    include: { medicine: true },
  });
  if (!batch) {
    throw new NotFoundError("Medicine batch not found in this branch");
  }

  // 3. Load Branch Configurations (Pharmacy + Billing)
  const pharmacyConfig = await loadPharmacyConfig(branchId);
  const billingConfig = await loadBillingConfig(branchId);

  // 4. STEP 4 & STEP 5 ENFORCEMENTS: Expiry date check
  const now = new Date();
  if (batch.expiryDate && new Date(batch.expiryDate) < now) {
    throw new BusinessRuleError(
      `Cannot dispense medicine: Batch '${batch.batchNo}' expired on ${batch.expiryDate.toISOString().split("T")[0]}`
    );
  }

  // 5. STEP 3 & STEP 9 ENFORCEMENTS: Stock validation & negative stock check
  if (batch.quantity < input.quantity) {
    throw new BusinessRuleError(
      `Insufficient stock: Available quantity is ${batch.quantity}, but requested ${input.quantity}`
    );
  }

  // 6. Pricing calculations: Unit price, subtotal, discount, tax
  const unitPrice = batch.sellingPrice ?? new Prisma.Decimal(0);
  const rawSubtotal = unitPrice.mul(input.quantity);

  // Discount precedence: input override > pharmacy setting default > 0
  const discountPercent =
    input.discountPercent !== undefined
      ? new Prisma.Decimal(input.discountPercent)
      : (pharmacyConfig.defaultDiscount ?? new Prisma.Decimal(0));

  const discountAmount = rawSubtotal.mul(discountPercent).div(100);
  const taxableAmount = rawSubtotal.minus(discountAmount);

  // Tax precedence: pharmacy setting tax > 0
  const taxPercent = pharmacyConfig.taxPercent ?? new Prisma.Decimal(0);
  const taxAmount = taxableAmount.mul(taxPercent).div(100);

  const grandTotal = taxableAmount.plus(taxAmount);

  // 7. Atomic Concurrency-Safe Transaction
  const result = await prisma.$transaction(async (tx) => {
    // ATOMIC STOCK DECREMENT with concurrency condition (quantity >= input.quantity)
    const updateResult = await tx.medicineBatch.updateMany({
      where: {
        id: input.batchId,
        branchId,
        quantity: { gte: input.quantity },
      },
      data: {
        quantity: { decrement: input.quantity },
      },
    });

    if (updateResult.count === 0) {
      throw new BusinessRuleError(
        "Stock update failed: Insufficient stock or concurrent modification detected."
      );
    }

    // Record Stock Movement (SALE)
    const stockMovement = await tx.stockMovement.create({
      data: {
        branchId,
        medicineId: input.medicineId,
        batchId: input.batchId,
        movementType: "SALE",
        quantity: input.quantity,
        unitPrice,
        referenceNo: `DISP-${Date.now()}`,
        notes: input.notes ?? `Dispensed ${input.quantity} units to patient ${patient.patientCode}`,
        createdById: actor.id,
      },
    });

    // Generate Invoice Number atomically
    const invoiceNumber = await generateNextInvoiceNumber(tx, branchId);

    // Create Invoice & InvoiceItem (financial snapshot preserved)
    const invoice = await tx.invoice.create({
      data: {
        branchId,
        patientId: input.patientId,
        invoiceNumber,
        subtotal: rawSubtotal,
        discountAmount,
        taxAmount,
        total: grandTotal,
        paidAmount: new Prisma.Decimal(0),
        dueAmount: grandTotal,
        status: "PENDING",
        issuedAt: new Date(),
        createdById: actor.id,
        items: {
          create: [
            {
              itemType: "pharmacy",
              description: `Pharmacy: ${batch.medicine.genericName} (Batch: ${batch.batchNo})`,
              quantity: input.quantity,
              unitPrice,
              total: rawSubtotal,
            },
          ],
        },
      },
      include: {
        items: true,
      },
    });

    return {
      stockMovement,
      invoice,
      appliedDiscountPercent: discountPercent.toNumber(),
      appliedTaxPercent: taxPercent.toNumber(),
      dispensedQuantity: input.quantity,
    };
  });

  await writeAuditLog({
    module: "PHARMACY",
    action: "MEDICINE_DISPENSED",
    tableName: "StockMovement",
    recordId: String(result.stockMovement.id),
    newValues: {
      patientId: input.patientId,
      medicineId: input.medicineId,
      batchId: input.batchId,
      quantity: input.quantity,
      invoiceNumber: result.invoice.invoiceNumber,
      appliedTaxPercent: result.appliedTaxPercent,
      appliedDiscountPercent: result.appliedDiscountPercent,
    },
    user: actor,
    branchId,
  });

  return result;
}

/* ------------------------------------------------------------------ *
 * Stock Adjustment
 * ------------------------------------------------------------------ */

export async function adjustStock(actor: AuthUser, input: AdjustStockInput) {
  const branchId = actor.branchId;

  const batch = await prisma.medicineBatch.findFirst({
    where: { id: input.batchId, branchId },
  });
  if (!batch) {
    throw new NotFoundError("Medicine batch not found in this branch");
  }

  if (input.quantityChange < 0 && batch.quantity < Math.abs(input.quantityChange)) {
    throw new BusinessRuleError(
      `Cannot reduce stock by ${Math.abs(input.quantityChange)}: Available stock is ${batch.quantity}`
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedBatch = await tx.medicineBatch.update({
      where: { id: input.batchId },
      data: {
        quantity: { increment: input.quantityChange },
      },
    });

    const stockMovement = await tx.stockMovement.create({
      data: {
        branchId,
        medicineId: batch.medicineId,
        batchId: input.batchId,
        movementType: "ADJUSTMENT",
        quantity: Math.abs(input.quantityChange),
        unitPrice: batch.purchasePrice ?? new Prisma.Decimal(0),
        referenceNo: `ADJ-${Date.now()}`,
        notes: input.notes,
        createdById: actor.id,
      },
    });

    return { batch: updatedBatch, stockMovement };
  });

  await writeAuditLog({
    module: "PHARMACY",
    action: "STOCK_ADJUSTED",
    tableName: "StockMovement",
    recordId: String(result.stockMovement.id),
    oldValues: { quantity: batch.quantity },
    newValues: {
      quantityChange: input.quantityChange,
      newQuantity: result.batch.quantity,
      notes: input.notes,
    },
    user: actor,
    branchId,
  });

  return result;
}

/* ------------------------------------------------------------------ *
 * Get Branch Pharmacy Config for UI
 * ------------------------------------------------------------------ */

export async function getPharmacyConfig(actor: AuthUser) {
  return loadPharmacyConfig(actor.branchId);
}
