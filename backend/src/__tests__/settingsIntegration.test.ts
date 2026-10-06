import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  loadOpdConfig,
  loadIpdConfig,
  loadEmergencyConfig,
  loadBillingConfig,
  calculateOpdFees,
  calculateIpdFees,
  calculateEmergencyFees,
  calculateInvoiceTotals,
} from "../modules/settings/settingsConfig";

vi.mock("../lib/prisma", () => {
  const prisma = {
    opdSetting: { findFirst: vi.fn() },
    ipdSetting: { findFirst: vi.fn() },
    emergencySetting: { findFirst: vi.fn() },
    billingSetting: { findFirst: vi.fn() },
    medicalRecord: { create: vi.fn() },
    admission: { create: vi.fn() },
    opdAppointment: { create: vi.fn() },
    emergencyVisit: { create: vi.fn() },
    invoice: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    patient: { findFirst: vi.fn() },
    doctor: { findFirst: vi.fn() },
    bed: { findFirst: vi.fn(), update: vi.fn() },
    codeSequence: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((cb) => cb(prisma)),
  };
  return { prisma };
});

const mockPrisma = vi.mocked(await import("../lib/prisma")).prisma;

import type { AuthUser } from "../types/auth";
import * as opdService from "../modules/opd/opd.service";
import * as ipdService from "../modules/ipd/ipd.service";

function makeActor(branchId = 1): AuthUser {
  return {
    id: 1,
    email: "test@hospital.com",
    name: "Test User",
    branchId,
    status: "ACTIVE",
    roles: [{ id: 1, seederKey: "ADMIN", name: "Admin" }],
  };
}

describe("Settings Integration across OPD, IPD, Emergency, and Billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("OPD Fee Calculation & Settings Integration", () => {
    it("calculates OPD fees based on branch settings", async () => {
      (mockPrisma.opdSetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        registrationFee: new Prisma.Decimal(500),
        consultationFee: new Prisma.Decimal(200),
        followUpDaysLimit: 7,
      });

      const fees1 = await calculateOpdFees(1);
      expect(fees1.registrationFee?.toNumber()).toBe(500);
      expect(fees1.consultationFee?.toNumber()).toBe(200);

      (mockPrisma.opdSetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        registrationFee: new Prisma.Decimal(700),
        consultationFee: new Prisma.Decimal(300),
        followUpDaysLimit: 7,
      });

      const fees2 = await calculateOpdFees(1);
      expect(fees2.registrationFee?.toNumber()).toBe(700);
    });

    it("creates OPD visit with fees calculated at visit creation time", async () => {
      (mockPrisma.opdSetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        registrationFee: new Prisma.Decimal(600),
        consultationFee: new Prisma.Decimal(250),
        followupDays: 7,
      });
      (mockPrisma.billingSetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        invoicePrefix: "INV-",
        taxPercent: new Prisma.Decimal(5),
      });
      (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 10,
        patientCode: "PAT-001",
        name: "John Doe",
      });
      (mockPrisma.doctor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 20 });
      (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ nextNumber: 1 });
      (mockPrisma.medicalRecord.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1,
        visitNumber: "VIS-000001",
      });
      (mockPrisma.invoice.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 101,
        invoiceNumber: "INV-000001",
      });

      const actor = makeActor(1);
      const result = await opdService.createOpdVisit(actor, {
        patientId: 10,
        doctorId: 20,
        visitType: "OPD",
      });

      expect(result.appliedFees.registrationFee).toBe("600.00");
      expect(result.appliedFees.consultationFee).toBe("250.00");
    });
  });

  describe("IPD Fee Calculation & Settings Integration", () => {
    it("calculates IPD fees dynamically based on branch admission settings", async () => {
      (mockPrisma.ipdSetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        admissionFee: new Prisma.Decimal(1500),
        bedCharge: new Prisma.Decimal(500),
        nursingCharge: new Prisma.Decimal(300),
        serviceCharge: new Prisma.Decimal(100),
      });

      const fees = await calculateIpdFees(1);
      expect(fees.admissionFee?.toNumber()).toBe(1500);
      expect(fees.bedCharge?.toNumber()).toBe(500);
    });

    it("creates IPD admission applying setting fees to snapshot invoice", async () => {
      (mockPrisma.ipdSetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        admissionFee: new Prisma.Decimal(1500),
        bedCharge: new Prisma.Decimal(500),
        nursingCharge: null,
        serviceCharge: null,
      });
      (mockPrisma.billingSetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        invoicePrefix: "INV-",
        taxPercent: new Prisma.Decimal(0),
      });
      (mockPrisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 10,
        patientCode: "PAT-001",
        name: "John Doe",
      });
      (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ nextNumber: 1 });
      (mockPrisma.admission.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1,
        admissionNumber: "ADM-000001",
        status: "ADMITTED",
        admissionDate: new Date(),
      });
      (mockPrisma.invoice.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 101,
        invoiceNumber: "INV-000001",
      });

      const actor = makeActor(1);
      const result = await ipdService.createAdmission(actor, {
        patientId: 10,
      });

      expect(result.appliedFees.admissionFee).toBe("1500.00");
    });
  });

  describe("Emergency Fee Calculation & Settings Integration", () => {
    it("calculates Emergency fees", async () => {
      (mockPrisma.emergencySetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        registrationFee: new Prisma.Decimal(1000),
        consultationFee: new Prisma.Decimal(500),
        serviceCharge: new Prisma.Decimal(200),
      });

      const fees = await calculateEmergencyFees(1);
      expect(fees.registrationFee?.toNumber()).toBe(1000);
      expect(fees.consultationFee?.toNumber()).toBe(500);
    });
  });

  describe("Billing Invoice Totals", () => {
    it("calculates billing tax and grand totals using BillingSetting", async () => {
      (mockPrisma.billingSetting.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 1,
        taxPercent: new Prisma.Decimal(10),
        serviceChargePercent: new Prisma.Decimal(5),
      });

      const totals = await calculateInvoiceTotals(1, {
        subtotal: new Prisma.Decimal(1000),
        discountAmount: new Prisma.Decimal(100),
      });

      expect(totals.taxAmount.toNumber()).toBe(90);
      expect(totals.serviceChargeAmount.toNumber()).toBe(45);
      expect(totals.grandTotal.toNumber()).toBe(1035);
    });
  });
});
