import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { loadPharmacyConfig } from "../modules/settings/settingsConfig";

vi.mock("../lib/prisma", () => {
  const prisma = {
    pharmacySetting: { findFirst: vi.fn() },
    billingSetting: { findFirst: vi.fn() },
    medicine: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    medicineBatch: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    stockMovement: { create: vi.fn() },
    invoice: { create: vi.fn() },
    patient: { findFirst: vi.fn() },
    codeSequence: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((cb) => cb(prisma)),
  };
  return { prisma };
});

const mockPrisma = vi.mocked(await import("../lib/prisma")).prisma;

import type { AuthUser } from "../types/auth";
import * as pharmacyService from "../modules/pharmacy/pharmacy.service";

function makeActor(branchId = 1, role = "PHARMACIST"): AuthUser {
  return {
    id: 10,
    email: "pharmacist@hospital.com",
    name: "Staff Pharmacist",
    branchId,
    status: "ACTIVE",
    roles: [{ id: 4, seederKey: role, name: role }],
  };
}

describe("Pharmacy Business Logic & Settings Integration Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("STEP 2 — Configuration Loading & Defaults", () => {
    it("returns default pharmacy config when no settings row exists for branch", async () => {
      (mockPrisma.pharmacySetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const config = await loadPharmacyConfig(1);
      expect(config.exists).toBe(false);
      expect(config.expiryAlertDays).toBe(30);
      expect(config.lowStockAlert).toBe(true);
      expect(config.barcodeEnabled).toBe(true);
      expect(config.batchEnabled).toBe(true);
    });

    it("loads custom branch pharmacy configuration when present", async () => {
      (mockPrisma.pharmacySetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        taxPercent: new Prisma.Decimal(7.5),
        defaultDiscount: new Prisma.Decimal(5.0),
        expiryAlertDays: 45,
        lowStockAlert: false,
        barcodeEnabled: true,
        batchEnabled: true,
      });

      const config = await loadPharmacyConfig(1);
      expect(config.exists).toBe(true);
      expect(config.taxPercent?.toNumber()).toBe(7.5);
      expect(config.defaultDiscount?.toNumber()).toBe(5.0);
      expect(config.expiryAlertDays).toBe(45);
      expect(config.lowStockAlert).toBe(false);
    });
  });

  describe("STEP 3 — Stock Behavior & Low Stock Thresholds", () => {
    it("flags medicine as low stock when stock <= reorderLevel and lowStockAlert is enabled", async () => {
      (mockPrisma.pharmacySetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        lowStockAlert: true,
        expiryAlertDays: 30,
      });

      (mockPrisma.medicine.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockPrisma.medicine.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 1,
          branchId: 1,
          genericName: "Paracetamol",
          medicineCode: "MED-001",
          reorderLevel: 20,
          batches: [
            { id: 101, batchNo: "B-01", quantity: 15, expiryDate: new Date("2028-01-01") },
          ],
        },
      ]);

      const result = await pharmacyService.listMedicines(makeActor(1), {});
      expect(result.data[0].totalStock).toBe(15);
      expect(result.data[0].isLowStock).toBe(true);
    });

    it("does NOT flag low stock when total stock exceeds reorderLevel", async () => {
      (mockPrisma.pharmacySetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        lowStockAlert: true,
        expiryAlertDays: 30,
      });

      (mockPrisma.medicine.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockPrisma.medicine.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 1,
          branchId: 1,
          genericName: "Paracetamol",
          medicineCode: "MED-001",
          reorderLevel: 20,
          batches: [
            { id: 101, batchNo: "B-01", quantity: 50, expiryDate: new Date("2028-01-01") },
          ],
        },
      ]);

      const result = await pharmacyService.listMedicines(makeActor(1), {});
      expect(result.data[0].totalStock).toBe(50);
      expect(result.data[0].isLowStock).toBe(false);
    });
  });

  describe("STEP 4 — Batch Expiry Enforcement", () => {
    it("rejects dispensing an EXPIRED batch", async () => {
      (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 5,
        patientCode: "PAT-005",
      });

      // Batch expired yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      (mockPrisma.medicineBatch.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 10,
        medicineId: 1,
        batchNo: "EXP-BATCH",
        quantity: 100,
        expiryDate: yesterday,
        sellingPrice: new Prisma.Decimal(10),
        medicine: { genericName: "Amoxicillin" },
      });

      await expect(
        pharmacyService.dispenseMedicine(makeActor(1), {
          patientId: 5,
          medicineId: 1,
          batchId: 10,
          quantity: 5,
        })
      ).rejects.toThrow("Cannot dispense medicine: Batch 'EXP-BATCH' expired");
    });

    it("correctly identifies expiring soon batches according to expiryAlertDays setting", async () => {
      (mockPrisma.pharmacySetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        expiryAlertDays: 15,
      });

      const in10Days = new Date();
      in10Days.setDate(in10Days.getDate() + 10);

      (mockPrisma.medicineBatch.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 10,
          batchNo: "SOON-01",
          quantity: 30,
          expiryDate: in10Days,
        },
      ]);

      const batches = await pharmacyService.listBatches(makeActor(1), 1);
      expect(batches[0].isExpiringSoon).toBe(true);
      expect(batches[0].isExpired).toBe(false);
    });
  });

  describe("STEP 5, 6, 8 — Medicine Dispensing, Stock Movement & Financial Snapshot", () => {
    it("dispenses valid medicine, records SALE stock movement, applies tax/discount from settings, and creates invoice", async () => {
      // Pharmacy settings: defaultDiscount = 10%, taxPercent = 5%
      (mockPrisma.pharmacySetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        defaultDiscount: new Prisma.Decimal(10),
        taxPercent: new Prisma.Decimal(5),
      });

      (mockPrisma.billingSetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        invoicePrefix: "INV-",
      });

      (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 5,
        patientCode: "PAT-005",
      });

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      (mockPrisma.medicineBatch.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 10,
        medicineId: 1,
        batchNo: "VALID-01",
        quantity: 50,
        expiryDate: futureDate,
        sellingPrice: new Prisma.Decimal(100), // 100 per unit * 2 units = 200 gross
        medicine: { genericName: "Ibuprofen" },
      });

      (mockPrisma.medicineBatch.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      (mockPrisma.stockMovement.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 201 });
      (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ nextNumber: 1 });
      (mockPrisma.invoice.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 301,
        invoiceNumber: "INV-000001",
        subtotal: new Prisma.Decimal(200),
        discountAmount: new Prisma.Decimal(20), // 10% of 200 = 20
        taxAmount: new Prisma.Decimal(9),        // 5% of (200-20=180) = 9
        total: new Prisma.Decimal(189),
      });

      const result = await pharmacyService.dispenseMedicine(makeActor(1), {
        patientId: 5,
        medicineId: 1,
        batchId: 10,
        quantity: 2,
      });

      expect(result.appliedDiscountPercent).toBe(10);
      expect(result.appliedTaxPercent).toBe(5);
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: "SALE",
            quantity: 2,
            batchId: 10,
          }),
        })
      );
      expect(mockPrisma.invoice.create).toHaveBeenCalled();
    });

    it("prevents negative stock dispensing", async () => {
      (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 5,
        patientCode: "PAT-005",
      });

      (mockPrisma.medicineBatch.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 10,
        medicineId: 1,
        batchNo: "LOW-01",
        quantity: 3, // Only 3 units available
        expiryDate: new Date("2029-01-01"),
        sellingPrice: new Prisma.Decimal(50),
        medicine: { genericName: "Ciprofloxacin" },
      });

      await expect(
        pharmacyService.dispenseMedicine(makeActor(1), {
          patientId: 5,
          medicineId: 1,
          batchId: 10,
          quantity: 10, // Requesting 10
        })
      ).rejects.toThrow("Insufficient stock: Available quantity is 3, but requested 10");
    });
  });

  describe("STEP 7 — Branch Isolation", () => {
    it("uses Branch A setting for Branch A operations and Branch B setting for Branch B operations", async () => {
      // Branch 1 config: defaultDiscount = 20%
      (mockPrisma.pharmacySetting.findFirst as ReturnType<typeof vi.fn>).mockImplementation(
        async ({ where }: { where: { branchId: number } }) => {
          if (where.branchId === 1) {
            return { branchId: 1, defaultDiscount: new Prisma.Decimal(20), taxPercent: null };
          }
          if (where.branchId === 2) {
            return { branchId: 2, defaultDiscount: new Prisma.Decimal(5), taxPercent: null };
          }
          return null;
        }
      );

      const configBranch1 = await loadPharmacyConfig(1);
      const configBranch2 = await loadPharmacyConfig(2);

      expect(configBranch1.defaultDiscount?.toNumber()).toBe(20);
      expect(configBranch2.defaultDiscount?.toNumber()).toBe(5);
    });

    it("rejects non-SuperAdmin operating on another branch", async () => {
      // Actor belongs to branch 1
      const actorBranch1 = makeActor(1, "PHARMACIST");

      (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        pharmacyService.dispenseMedicine(actorBranch1, {
          patientId: 5,
          medicineId: 1,
          batchId: 10,
          quantity: 1,
        })
      ).rejects.toThrow("Patient not found in this branch");
    });
  });

  describe("STEP 9 — Concurrency & Atomic Stock Safety", () => {
    it("fails when atomic update result count is 0 due to concurrent stock depletion", async () => {
      (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 5,
        patientCode: "PAT-005",
      });

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      (mockPrisma.medicineBatch.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 10,
        medicineId: 1,
        batchNo: "RACE-01",
        quantity: 5,
        expiryDate: futureDate,
        sellingPrice: new Prisma.Decimal(10),
        medicine: { genericName: "Aspirin" },
      });

      // Simulate concurrent update failure (updateMany returning count: 0 because stock was taken by another thread)
      (mockPrisma.medicineBatch.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

      await expect(
        pharmacyService.dispenseMedicine(makeActor(1), {
          patientId: 5,
          medicineId: 1,
          batchId: 10,
          quantity: 5,
        })
      ).rejects.toThrow("Stock update failed: Insufficient stock or concurrent modification detected");
    });
  });
});
