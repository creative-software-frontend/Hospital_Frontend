import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

/* ------------------------------------------------------------------ *
 * Types: Effective configuration objects with defaults & coercion
 * ------------------------------------------------------------------ */

export type EffectiveOpdConfig = {
  exists: boolean;
  registrationFee: Prisma.Decimal | null;
  consultationFee: Prisma.Decimal | null;
  followupDays: number;
  appointmentDuration: number;
  queueEnabled: boolean;
  prescriptionEnabled: boolean;
};

export type EffectiveIpdConfig = {
  exists: boolean;
  admissionFee: Prisma.Decimal | null;
  dischargeFee: Prisma.Decimal | null;
  bedCharge: Prisma.Decimal | null;
  nursingCharge: Prisma.Decimal | null;
  serviceCharge: Prisma.Decimal | null;
};

export type EffectiveEmergencyConfig = {
  exists: boolean;
  registrationFee: Prisma.Decimal | null;
  consultationFee: Prisma.Decimal | null;
  serviceCharge: Prisma.Decimal | null;
  triageEnabled: boolean;
};

export type EffectivePharmacyConfig = {
  exists: boolean;
  taxPercent: Prisma.Decimal | null;
  defaultDiscount: Prisma.Decimal | null;
  expiryAlertDays: number;
  lowStockAlert: boolean;
  barcodeEnabled: boolean;
  batchEnabled: boolean;
};

export type EffectiveLabConfig = {
  exists: boolean;
  sampleTrackingEnabled: boolean;
  barcodeEnabled: boolean;
  onlineReportEnabled: boolean;
  reportApprovalRequired: boolean;
  defaultReportTemplate: string | null;
};

export type EffectiveBillingConfig = {
  exists: boolean;
  invoicePrefix: string;
  invoiceStartNumber: number;
  receiptPrefix: string;
  taxPercent: Prisma.Decimal | null;
  serviceChargePercent: Prisma.Decimal | null;
  discountEnabled: boolean;
  partialPaymentEnabled: boolean;
  refundEnabled: boolean;
  duePaymentEnabled: boolean;
};

export type EffectiveHrConfig = {
  exists: boolean;
  payrollCycle: string;
  salaryDisbursementDay: number;
  annualLeaveDays: number;
  overtimeRate: Prisma.Decimal | null;
};

export type EffectiveInventoryConfig = {
  exists: boolean;
  trackMedicalEquipment: boolean;
  assetBarcode: boolean;
  lowStockAlert: boolean;
  autoReorder: boolean;
  stockTransferApproval: boolean;
};

export type EffectiveAccountingConfig = {
  exists: boolean;
  fiscalYear: string;
  baseCurrency: string;
  chartOfAccounts: string;
  autoPostToLedger: boolean;
  trialBalanceFrequency: string;
  voucherEnabled: boolean;
};

export type EffectiveNotificationConfig = {
  exists: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  appointmentNotification: boolean;
  billingNotification: boolean;
  labNotification: boolean;
  followupNotification: boolean;
  paymentNotification: boolean;
};

/* ------------------------------------------------------------------ *
 * Defaults (match schema defaults)
 * ------------------------------------------------------------------ */

const DEFAULT_OPD_CONFIG: Omit<EffectiveOpdConfig, "exists"> = {
  registrationFee: null,
  consultationFee: null,
  followupDays: 14,
  appointmentDuration: 15,
  queueEnabled: true,
  prescriptionEnabled: true,
};

const DEFAULT_IPD_CONFIG: Omit<EffectiveIpdConfig, "exists"> = {
  admissionFee: null,
  dischargeFee: null,
  bedCharge: null,
  nursingCharge: null,
  serviceCharge: null,
};

const DEFAULT_EMERGENCY_CONFIG: Omit<EffectiveEmergencyConfig, "exists"> = {
  registrationFee: null,
  consultationFee: null,
  serviceCharge: null,
  triageEnabled: true,
};

const DEFAULT_PHARMACY_CONFIG: Omit<EffectivePharmacyConfig, "exists"> = {
  taxPercent: null,
  defaultDiscount: null,
  expiryAlertDays: 30,
  lowStockAlert: true,
  barcodeEnabled: true,
  batchEnabled: true,
};

const DEFAULT_LAB_CONFIG: Omit<EffectiveLabConfig, "exists"> = {
  sampleTrackingEnabled: true,
  barcodeEnabled: true,
  onlineReportEnabled: true,
  reportApprovalRequired: false,
  defaultReportTemplate: null,
};

const DEFAULT_BILLING_CONFIG: Omit<EffectiveBillingConfig, "exists"> = {
  invoicePrefix: "INV-",
  invoiceStartNumber: 1,
  receiptPrefix: "RCT-",
  taxPercent: null,
  serviceChargePercent: null,
  discountEnabled: true,
  partialPaymentEnabled: true,
  refundEnabled: true,
  duePaymentEnabled: true,
};

const DEFAULT_HR_CONFIG: Omit<EffectiveHrConfig, "exists"> = {
  payrollCycle: "monthly",
  salaryDisbursementDay: 1,
  annualLeaveDays: 18,
  overtimeRate: null,
};

const DEFAULT_INVENTORY_CONFIG: Omit<EffectiveInventoryConfig, "exists"> = {
  trackMedicalEquipment: true,
  assetBarcode: true,
  lowStockAlert: true,
  autoReorder: true,
  stockTransferApproval: true,
};

const DEFAULT_ACCOUNTING_CONFIG: Omit<EffectiveAccountingConfig, "exists"> = {
  fiscalYear: "July 2025 - June 2026",
  baseCurrency: "BDT",
  chartOfAccounts: "Hospital Standard",
  autoPostToLedger: true,
  trialBalanceFrequency: "monthly",
  voucherEnabled: true,
};

const DEFAULT_NOTIFICATION_CONFIG: Omit<EffectiveNotificationConfig, "exists"> = {
  smsEnabled: false,
  emailEnabled: false,
  whatsappEnabled: false,
  appointmentNotification: true,
  billingNotification: true,
  labNotification: true,
  followupNotification: true,
  paymentNotification: true,
};

/* ------------------------------------------------------------------ *
 * Loader functions — one per domain, branch-scoped, with defaults
 * ------------------------------------------------------------------ */

export async function loadOpdConfig(branchId: number): Promise<EffectiveOpdConfig> {
  const s = await prisma.opdSetting.findFirst({
    where: { branchId },
    orderBy: { id: "asc" },
    select: {
      registrationFee: true,
      consultationFee: true,
      followupDays: true,
      appointmentDuration: true,
      queueEnabled: true,
      prescriptionEnabled: true,
    },
  });
  if (!s) return { exists: false, ...DEFAULT_OPD_CONFIG };
  return {
    exists: true,
    registrationFee: s.registrationFee,
    consultationFee: s.consultationFee,
    followupDays: s.followupDays ?? DEFAULT_OPD_CONFIG.followupDays,
    appointmentDuration: s.appointmentDuration ?? DEFAULT_OPD_CONFIG.appointmentDuration,
    queueEnabled: s.queueEnabled ?? DEFAULT_OPD_CONFIG.queueEnabled,
    prescriptionEnabled: s.prescriptionEnabled ?? DEFAULT_OPD_CONFIG.prescriptionEnabled,
  };
}

export async function loadIpdConfig(branchId: number): Promise<EffectiveIpdConfig> {
  const s = await prisma.ipdSetting.findFirst({
    where: { branchId },
    orderBy: { id: "asc" },
    select: {
      admissionFee: true,
      dischargeFee: true,
      bedCharge: true,
      nursingCharge: true,
      serviceCharge: true,
    },
  });
  if (!s) return { exists: false, ...DEFAULT_IPD_CONFIG };
  return {
    exists: true,
    admissionFee: s.admissionFee,
    dischargeFee: s.dischargeFee,
    bedCharge: s.bedCharge,
    nursingCharge: s.nursingCharge,
    serviceCharge: s.serviceCharge,
  };
}

export async function loadEmergencyConfig(branchId: number): Promise<EffectiveEmergencyConfig> {
  const s = await prisma.emergencySetting.findFirst({
    where: { branchId },
    orderBy: { id: "asc" },
    select: {
      registrationFee: true,
      consultationFee: true,
      serviceCharge: true,
      triageEnabled: true,
    },
  });
  if (!s) return { exists: false, ...DEFAULT_EMERGENCY_CONFIG };
  return {
    exists: true,
    registrationFee: s.registrationFee,
    consultationFee: s.consultationFee,
    serviceCharge: s.serviceCharge,
    triageEnabled: s.triageEnabled ?? DEFAULT_EMERGENCY_CONFIG.triageEnabled,
  };
}

export async function loadPharmacyConfig(branchId: number): Promise<EffectivePharmacyConfig> {
  const s = await prisma.pharmacySetting.findFirst({
    where: { branchId },
    orderBy: { id: "asc" },
    select: {
      taxPercent: true,
      defaultDiscount: true,
      expiryAlertDays: true,
      lowStockAlert: true,
      barcodeEnabled: true,
      batchEnabled: true,
    },
  });
  if (!s) return { exists: false, ...DEFAULT_PHARMACY_CONFIG };
  return {
    exists: true,
    taxPercent: s.taxPercent,
    defaultDiscount: s.defaultDiscount,
    expiryAlertDays: s.expiryAlertDays ?? DEFAULT_PHARMACY_CONFIG.expiryAlertDays,
    lowStockAlert: s.lowStockAlert ?? DEFAULT_PHARMACY_CONFIG.lowStockAlert,
    barcodeEnabled: s.barcodeEnabled ?? DEFAULT_PHARMACY_CONFIG.barcodeEnabled,
    batchEnabled: s.batchEnabled ?? DEFAULT_PHARMACY_CONFIG.batchEnabled,
  };
}

export async function loadLabConfig(branchId: number): Promise<EffectiveLabConfig> {
  const s = await prisma.labSetting.findFirst({
    where: { branchId },
    orderBy: { id: "asc" },
    select: {
      sampleTrackingEnabled: true,
      barcodeEnabled: true,
      onlineReportEnabled: true,
      reportApprovalRequired: true,
      defaultReportTemplate: true,
    },
  });
  if (!s) return { exists: false, ...DEFAULT_LAB_CONFIG };
  return {
    exists: true,
    sampleTrackingEnabled: s.sampleTrackingEnabled ?? DEFAULT_LAB_CONFIG.sampleTrackingEnabled,
    barcodeEnabled: s.barcodeEnabled ?? DEFAULT_LAB_CONFIG.barcodeEnabled,
    onlineReportEnabled: s.onlineReportEnabled ?? DEFAULT_LAB_CONFIG.onlineReportEnabled,
    reportApprovalRequired: s.reportApprovalRequired ?? DEFAULT_LAB_CONFIG.reportApprovalRequired,
    defaultReportTemplate: s.defaultReportTemplate ?? DEFAULT_LAB_CONFIG.defaultReportTemplate,
  };
}

export async function loadBillingConfig(branchId: number): Promise<EffectiveBillingConfig> {
  const s = await prisma.billingSetting.findFirst({
    where: { branchId },
    orderBy: { id: "asc" },
    select: {
      invoicePrefix: true,
      invoiceStartNumber: true,
      receiptPrefix: true,
      taxPercent: true,
      serviceChargePercent: true,
      discountEnabled: true,
      partialPaymentEnabled: true,
      refundEnabled: true,
      duePaymentEnabled: true,
    },
  });
  if (!s) return { exists: false, ...DEFAULT_BILLING_CONFIG };
  return {
    exists: true,
    invoicePrefix: s.invoicePrefix ?? DEFAULT_BILLING_CONFIG.invoicePrefix,
    invoiceStartNumber: s.invoiceStartNumber ?? DEFAULT_BILLING_CONFIG.invoiceStartNumber,
    receiptPrefix: s.receiptPrefix ?? DEFAULT_BILLING_CONFIG.receiptPrefix,
    taxPercent: s.taxPercent,
    serviceChargePercent: s.serviceChargePercent,
    discountEnabled: s.discountEnabled ?? DEFAULT_BILLING_CONFIG.discountEnabled,
    partialPaymentEnabled: s.partialPaymentEnabled ?? DEFAULT_BILLING_CONFIG.partialPaymentEnabled,
    refundEnabled: s.refundEnabled ?? DEFAULT_BILLING_CONFIG.refundEnabled,
    duePaymentEnabled: s.duePaymentEnabled ?? DEFAULT_BILLING_CONFIG.duePaymentEnabled,
  };
}

export async function loadHrConfig(branchId: number): Promise<EffectiveHrConfig> {
  const s = await prisma.hrSetting.findFirst({
    where: { branchId },
    orderBy: { id: "asc" },
    select: {
      payrollCycle: true,
      salaryDisbursementDay: true,
      annualLeaveDays: true,
      overtimeRate: true,
    },
  });
  if (!s) return { exists: false, ...DEFAULT_HR_CONFIG };
  return {
    exists: true,
    payrollCycle: s.payrollCycle ?? DEFAULT_HR_CONFIG.payrollCycle,
    salaryDisbursementDay: s.salaryDisbursementDay ?? DEFAULT_HR_CONFIG.salaryDisbursementDay,
    annualLeaveDays: s.annualLeaveDays ?? DEFAULT_HR_CONFIG.annualLeaveDays,
    overtimeRate: s.overtimeRate,
  };
}

export async function loadInventoryConfig(branchId: number): Promise<EffectiveInventoryConfig> {
  const s = await prisma.inventorySetting.findFirst({
    where: { branchId },
    orderBy: { id: "asc" },
    select: {
      trackMedicalEquipment: true,
      assetBarcode: true,
      lowStockAlert: true,
      autoReorder: true,
      stockTransferApproval: true,
    },
  });
  if (!s) return { exists: false, ...DEFAULT_INVENTORY_CONFIG };
  return {
    exists: true,
    trackMedicalEquipment: s.trackMedicalEquipment ?? DEFAULT_INVENTORY_CONFIG.trackMedicalEquipment,
    assetBarcode: s.assetBarcode ?? DEFAULT_INVENTORY_CONFIG.assetBarcode,
    lowStockAlert: s.lowStockAlert ?? DEFAULT_INVENTORY_CONFIG.lowStockAlert,
    autoReorder: s.autoReorder ?? DEFAULT_INVENTORY_CONFIG.autoReorder,
    stockTransferApproval: s.stockTransferApproval ?? DEFAULT_INVENTORY_CONFIG.stockTransferApproval,
  };
}

export async function loadAccountingConfig(branchId: number): Promise<EffectiveAccountingConfig> {
  const s = await prisma.accountingSetting.findFirst({
    where: { branchId },
    orderBy: { id: "asc" },
    select: {
      fiscalYear: true,
      baseCurrency: true,
      chartOfAccounts: true,
      autoPostToLedger: true,
      trialBalanceFrequency: true,
      voucherEnabled: true,
    },
  });
  if (!s) return { exists: false, ...DEFAULT_ACCOUNTING_CONFIG };
  return {
    exists: true,
    fiscalYear: s.fiscalYear ?? DEFAULT_ACCOUNTING_CONFIG.fiscalYear,
    baseCurrency: s.baseCurrency ?? DEFAULT_ACCOUNTING_CONFIG.baseCurrency,
    chartOfAccounts: s.chartOfAccounts ?? DEFAULT_ACCOUNTING_CONFIG.chartOfAccounts,
    autoPostToLedger: s.autoPostToLedger ?? DEFAULT_ACCOUNTING_CONFIG.autoPostToLedger,
    trialBalanceFrequency: s.trialBalanceFrequency ?? DEFAULT_ACCOUNTING_CONFIG.trialBalanceFrequency,
    voucherEnabled: s.voucherEnabled ?? DEFAULT_ACCOUNTING_CONFIG.voucherEnabled,
  };
}

export async function loadNotificationConfig(branchId: number): Promise<EffectiveNotificationConfig> {
  const s = await prisma.notificationSetting.findFirst({
    where: { branchId },
    orderBy: { id: "asc" },
    select: {
      smsEnabled: true,
      emailEnabled: true,
      whatsappEnabled: true,
      appointmentNotification: true,
      billingNotification: true,
      labNotification: true,
      followupNotification: true,
      paymentNotification: true,
    },
  });
  if (!s) return { exists: false, ...DEFAULT_NOTIFICATION_CONFIG };
  return {
    exists: true,
    smsEnabled: s.smsEnabled ?? DEFAULT_NOTIFICATION_CONFIG.smsEnabled,
    emailEnabled: s.emailEnabled ?? DEFAULT_NOTIFICATION_CONFIG.emailEnabled,
    whatsappEnabled: s.whatsappEnabled ?? DEFAULT_NOTIFICATION_CONFIG.whatsappEnabled,
    appointmentNotification: s.appointmentNotification ?? DEFAULT_NOTIFICATION_CONFIG.appointmentNotification,
    billingNotification: s.billingNotification ?? DEFAULT_NOTIFICATION_CONFIG.billingNotification,
    labNotification: s.labNotification ?? DEFAULT_NOTIFICATION_CONFIG.labNotification,
    followupNotification: s.followupNotification ?? DEFAULT_NOTIFICATION_CONFIG.followupNotification,
    paymentNotification: s.paymentNotification ?? DEFAULT_NOTIFICATION_CONFIG.paymentNotification,
  };
}

/* ------------------------------------------------------------------ *
 * Fee/Charge calculators — ready for business logic consumption
 * ------------------------------------------------------------------ */

export interface OpdFees {
  registrationFee: Prisma.Decimal | null;
  consultationFee: Prisma.Decimal | null;
}

export async function calculateOpdFees(branchId: number): Promise<OpdFees> {
  const config = await loadOpdConfig(branchId);
  return {
    registrationFee: config.registrationFee,
    consultationFee: config.consultationFee,
  };
}

export interface IpdFees {
  admissionFee: Prisma.Decimal | null;
  dischargeFee: Prisma.Decimal | null;
  bedCharge: Prisma.Decimal | null;
  nursingCharge: Prisma.Decimal | null;
  serviceCharge: Prisma.Decimal | null;
}

export async function calculateIpdFees(branchId: number): Promise<IpdFees> {
  const config = await loadIpdConfig(branchId);
  return {
    admissionFee: config.admissionFee,
    dischargeFee: config.dischargeFee,
    bedCharge: config.bedCharge,
    nursingCharge: config.nursingCharge,
    serviceCharge: config.serviceCharge,
  };
}

export interface EmergencyFees {
  registrationFee: Prisma.Decimal | null;
  consultationFee: Prisma.Decimal | null;
  serviceCharge: Prisma.Decimal | null;
}

export async function calculateEmergencyFees(branchId: number): Promise<EmergencyFees> {
  const config = await loadEmergencyConfig(branchId);
  return {
    registrationFee: config.registrationFee,
    consultationFee: config.consultationFee,
    serviceCharge: config.serviceCharge,
  };
}

export interface BillingCalculationInput {
  subtotal: Prisma.Decimal;
  discountAmount?: Prisma.Decimal;
  taxPercent?: Prisma.Decimal;
  serviceChargePercent?: Prisma.Decimal;
}

export interface BillingCalculationResult {
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  serviceChargeAmount: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}

/**
 * Calculate invoice totals using branch billing settings.
 * Settings used: taxPercent, serviceChargePercent, discountEnabled.
 */
export async function calculateInvoiceTotals(
  branchId: number,
  input: BillingCalculationInput,
): Promise<BillingCalculationResult> {
  const config = await loadBillingConfig(branchId);

  const subtotal = input.subtotal;
  const discountAmount = input.discountAmount ?? new Prisma.Decimal(0);
  const taxableAmount = subtotal.minus(discountAmount);

  const taxPercent = config.taxPercent ?? input.taxPercent ?? new Prisma.Decimal(0);
  const taxAmount = taxableAmount.mul(taxPercent).div(100);

  const serviceChargePercent = config.serviceChargePercent ?? input.serviceChargePercent ?? new Prisma.Decimal(0);
  const serviceChargeAmount = taxableAmount.mul(serviceChargePercent).div(100);

  const grandTotal = taxableAmount.plus(taxAmount).plus(serviceChargeAmount);

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    serviceChargeAmount,
    grandTotal,
  };
}

/**
 * Generate next invoice number atomically using branch billing settings.
 *
 * MUST be called inside a prisma.$transaction() so that the sequence
 * increment is rolled back if the invoice creation fails.
 *
 * Uses the CodeSequence table (same mechanism as patient/doctor codes) to
 * guarantee no two concurrent requests receive the same number.
 */
export async function generateNextInvoiceNumber(
  tx: import("@prisma/client").Prisma.TransactionClient,
  branchId: number,
): Promise<string> {
  const config = await loadBillingConfig(branchId);
  const prefix = config.invoicePrefix ?? "INV-";

  const row = await tx.codeSequence.upsert({
    where: { entity_branchId: { entity: "Invoice", branchId } },
    update: { nextNumber: { increment: 1 } },
    create: { entity: "Invoice", branchId, nextNumber: 1 },
    select: { nextNumber: true },
  });

  const padded = String(row.nextNumber).padStart(6, "0");
  // The prefix is stored with or without a trailing dash; normalise once.
  const cleanPrefix = prefix.replace(/[-\s]+$/, "");
  return `${cleanPrefix}-${padded}`;
}

/**
 * Generate next receipt number atomically using branch billing settings.
 *
 * MUST be called inside a prisma.$transaction() for the same reason as
 * generateNextInvoiceNumber.
 */
export async function generateNextReceiptNumber(
  tx: import("@prisma/client").Prisma.TransactionClient,
  branchId: number,
): Promise<string> {
  const config = await loadBillingConfig(branchId);
  const prefix = config.receiptPrefix ?? "RCT-";

  const row = await tx.codeSequence.upsert({
    where: { entity_branchId: { entity: "Receipt", branchId } },
    update: { nextNumber: { increment: 1 } },
    create: { entity: "Receipt", branchId, nextNumber: 1 },
    select: { nextNumber: true },
  });

  const padded = String(row.nextNumber).padStart(6, "0");
  const cleanPrefix = prefix.replace(/[-\s]+$/, "");
  return `${cleanPrefix}-${padded}`;
}


/* ------------------------------------------------------------------ *
 * Composite loader — loads all configs for a branch in one call
 * Useful for startup, admin dashboards, or batch operations
 * ------------------------------------------------------------------ */

export type AllEffectiveConfigs = {
  opd: EffectiveOpdConfig;
  ipd: EffectiveIpdConfig;
  emergency: EffectiveEmergencyConfig;
  pharmacy: EffectivePharmacyConfig;
  lab: EffectiveLabConfig;
  billing: EffectiveBillingConfig;
  hr: EffectiveHrConfig;
  inventory: EffectiveInventoryConfig;
  accounting: EffectiveAccountingConfig;
  notification: EffectiveNotificationConfig;
};

export async function loadAllConfigs(branchId: number): Promise<AllEffectiveConfigs> {
  const [
    opd,
    ipd,
    emergency,
    pharmacy,
    lab,
    billing,
    hr,
    inventory,
    accounting,
    notification,
  ] = await Promise.all([
    loadOpdConfig(branchId),
    loadIpdConfig(branchId),
    loadEmergencyConfig(branchId),
    loadPharmacyConfig(branchId),
    loadLabConfig(branchId),
    loadBillingConfig(branchId),
    loadHrConfig(branchId),
    loadInventoryConfig(branchId),
    loadAccountingConfig(branchId),
    loadNotificationConfig(branchId),
  ]);
  return { opd, ipd, emergency, pharmacy, lab, billing, hr, inventory, accounting, notification };
}