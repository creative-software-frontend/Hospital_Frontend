import { z } from "zod";
import { MAX_SESSION_TIMEOUT_MINUTES } from "../../utils/token";
import { ADDRESS_CATEGORY_PARENT, isAddressCategory } from "../../lib/bangladeshAddress";
// Imported from the registry so the API's accepted categories and the tables that
// actually back them cannot drift apart. Re-exported because other modules import
// the list from here.
import { MASTER_DATA_CATEGORIES } from "../../lib/masterDataRegistry";
import {
  GUARDIAN_REQUIREMENT_VALUES,
  PATIENT_TYPE_VALUES,
} from "../patients/patient.policy";

export { MASTER_DATA_CATEGORIES };

export const SETTING_STATUS_VALUES = ["active", "inactive"] as const;

/**
 * Optional free text. The API clients send JSON `null` for a blank optional
 * field (and `""` for a cleared one), so both have to collapse to `undefined`
 * — otherwise every create without a key fails validation, and an update that
 * intends to *keep* the stored value can never be expressed.
 */
const optionalString = (max: number) =>
  z
    .union([
      z.string().trim().max(max, `Must be at most ${max} characters`),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((value) => (value === null || value === "" ? undefined : value));

/* System settings (general) ----------------------------------------------- */

export const listSystemSettingsQuerySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export const upsertSystemSettingSchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  settingGroup: z.string().trim().min(1, "settingGroup is required").max(64),
  settingKey: z.string().trim().min(1, "settingKey is required").max(128),
  settingValue: optionalString(255),
  dataType: optionalString(16),
  isEncrypted: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

// Revealing a file from the public folder in the OS file manager (development
// only). The path is resolved and confined to public/ server-side.
export const revealAssetPathSchema = z.object({
  path: z.string().trim().min(1, "path is required").max(512),
});

/* Security settings -------------------------------------------------------- */

export const updateSecuritySettingSchema = z.object({
    passwordMinLength: z.number().int().min(4).max(64).optional(),
    passwordExpiryDays: z.number().int().min(0).max(3650).optional(),
    maxLoginAttempts: z.number().int().min(1).max(50).optional(),
    /**
     * Session timeout in minutes. Capped at the access-token ceiling in
     * utils/token.ts so the configured value can always be honored; the token
     * would otherwise expire first and the setting would silently do nothing.
     */
    sessionTimeout: z.number().int().min(1).max(MAX_SESSION_TIMEOUT_MINUTES).optional(),
    twoFactorEnabled: z.boolean().optional(),
    ipRestrictionEnabled: z.boolean().optional(),
    deviceRestrictionEnabled: z.boolean().optional(),
    auditLogEnabled: z.boolean().optional(),
    passwordRequireUppercase: z.boolean().optional(),
    passwordRequireLowercase: z.boolean().optional(),
    passwordRequireNumber: z.boolean().optional(),
    passwordRequireSymbol: z.boolean().optional(),
    passwordHistoryCount: z.number().int().min(0).max(24).optional(),
    lockoutDurationMinutes: z.number().int().min(1).max(1440).optional(),
    allowedIpRanges: z.string().max(1000).optional(),
    maxConcurrentSessions: z.number().int().min(1).max(50).optional(),
    status: z.enum(SETTING_STATUS_VALUES).optional(),
  });

export type ListSystemSettingsQuery = z.infer<typeof listSystemSettingsQuerySchema>;
export type UpsertSystemSettingInput = z.infer<typeof upsertSystemSettingSchema>;
export type RevealAssetPathInput = z.infer<typeof revealAssetPathSchema>;
export type UpdateSecuritySettingInput = z.infer<typeof updateSecuritySettingSchema>;

/* Localization (Settings → Localization) ------------------------------------ */

/**
 * SINGLE currency catalog — the hospital's supported ISO 4217 codes.
 * Mirrors the frontend `LOCALIZATION_CURRENCIES` list exactly. The currency set
 * in Settings → Localization is the authoritative hospital-wide display currency.
 */
export const LOCALIZATION_CURRENCY_CODES = ["BDT", "USD", "GBP", "EUR", "INR", "SAR"] as const;

export const updateLocalizationSettingSchema = z.object({
  language: z.string().trim().min(1).max(64).optional(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "currency must be a 3-letter ISO 4217 code")
    .refine(
      (code) => (LOCALIZATION_CURRENCY_CODES as readonly string[]).includes(code),
      { message: "currency is not in the supported Localization currency catalog" },
    )
    .optional(),
  currencySymbol: z.string().trim().min(1).max(8).optional(),
  dateFormat: z.string().trim().min(1).max(16).optional(),
  timeFormat: z.enum(["12h", "24h"]).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  numberFormat: z.string().trim().max(16).optional().nullable(),
  weekStartDay: z.number().int().min(0).max(6).optional(),
});

export type UpdateLocalizationSettingInput = z.infer<typeof updateLocalizationSettingSchema>;

/* Patient configuration settings ------------------------------------------- */

export const updatePatientSettingSchema = z.object({
  /**
   * Stored verbatim; codes are rendered as `<prefix>-<sequence>` so a trailing
   * separator is optional. Kept to letters and digits because the value is
   * printed on patient cards and barcodes.
   */
  patientIdPrefix: z
    .string()
    .trim()
    .min(2, "Patient ID prefix must be at least 2 characters")
    .max(8, "Patient ID prefix must be at most 8 characters")
    .regex(
      /^[A-Za-z0-9]+[-\s]*$/,
      "Patient ID prefix may only contain letters and numbers",
    )
    .optional(),
  autoGenerateId: z.boolean().optional(),
  defaultPatientType: z.enum(PATIENT_TYPE_VALUES).optional(),
  requireGuardian: z.enum(GUARDIAN_REQUIREMENT_VALUES).optional(),
  duplicateDetection: z.boolean().optional(),
  phoneRequired: z.boolean().optional(),
  emailRequired: z.boolean().optional(),
  whatsappRequired: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export type UpdatePatientSettingInput = z.infer<typeof updatePatientSettingSchema>;

/* Clinical settings (Settings → Clinical Settings) ------------------------- */

const optionalMoney = z
  .union([z.string().trim(), z.number()])
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

const optionalInt = (min: number, max: number) =>
  z.number().int().min(min).max(max).optional();

export const updateOpdSettingSchema = z.object({
  registrationFee: optionalMoney,
  consultationFee: optionalMoney,
  followupDays: optionalInt(0, 365),
  appointmentDuration: optionalInt(1, 240),
  queueEnabled: z.boolean().optional(),
  prescriptionEnabled: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export const updateIpdSettingSchema = z.object({
  admissionFee: optionalMoney,
  dischargeFee: optionalMoney,
  bedCharge: optionalMoney,
  nursingCharge: optionalMoney,
  serviceCharge: optionalMoney,
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export const updateEmergencySettingSchema = z.object({
  registrationFee: optionalMoney,
  consultationFee: optionalMoney,
  serviceCharge: optionalMoney,
  triageEnabled: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export const updatePrescriptionSettingSchema = z.object({
  showPatientHistory: z.boolean().optional(),
  showDiagnosis: z.boolean().optional(),
  showMedicine: z.boolean().optional(),
  showDosage: z.boolean().optional(),
  showInstruction: z.boolean().optional(),
  showDoctorSignature: z.boolean().optional(),
  showQrCode: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export type UpdateOpdSettingInput = z.infer<typeof updateOpdSettingSchema>;
export type UpdateIpdSettingInput = z.infer<typeof updateIpdSettingSchema>;
export type UpdateEmergencySettingInput = z.infer<typeof updateEmergencySettingSchema>;
export type UpdatePrescriptionSettingInput = z.infer<typeof updatePrescriptionSettingSchema>;

/* Pharmacy settings (Settings → Pharmacy Settings) ------------------------- */

export const updatePharmacySettingSchema = z.object({
  taxPercent: optionalMoney,
  defaultDiscount: optionalMoney,
  expiryAlertDays: optionalInt(1, 365),
  lowStockAlert: z.boolean().optional(),
  barcodeEnabled: z.boolean().optional(),
  batchEnabled: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export type UpdatePharmacySettingInput = z.infer<typeof updatePharmacySettingSchema>;

/* Laboratory settings (Settings → Laboratory Settings) --------------------- */

export const updateLabSettingSchema = z.object({
  sampleTrackingEnabled: z.boolean().optional(),
  barcodeEnabled: z.boolean().optional(),
  onlineReportEnabled: z.boolean().optional(),
  reportApprovalRequired: z.boolean().optional(),
  defaultReportTemplate: z
    .string()
    .trim()
    .max(128, "Must be at most 128 characters")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export type UpdateLabSettingInput = z.infer<typeof updateLabSettingSchema>;

/* Billing settings (Settings → Billing Settings) --------------------------- */

export const updateBillingSettingSchema = z.object({
  invoicePrefix: z.string().trim().max(32).optional(),
  invoiceStartNumber: z.number().int().min(1).max(1_000_000).optional(),
  receiptPrefix: z.string().trim().max(32).optional(),
  taxPercent: optionalMoney,
  serviceChargePercent: optionalMoney,
  discountEnabled: z.boolean().optional(),
  partialPaymentEnabled: z.boolean().optional(),
  refundEnabled: z.boolean().optional(),
  duePaymentEnabled: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export type UpdateBillingSettingInput = z.infer<typeof updateBillingSettingSchema>;

/* Accounting settings (Settings → Accounting Settings) --------------------- */

const TRIAL_BALANCE_FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;

export const updateAccountingSettingSchema = z.object({
  fiscalYear: z.string().trim().max(64).optional(),
  baseCurrency: z.string().trim().max(16).optional(),
  chartOfAccounts: z.string().trim().max(64).optional(),
  autoPostToLedger: z.boolean().optional(),
  trialBalanceFrequency: z.enum(TRIAL_BALANCE_FREQUENCIES).optional(),
  voucherEnabled: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export type UpdateAccountingSettingInput = z.infer<typeof updateAccountingSettingSchema>;

/* HR & Payroll settings (Settings → HR & Payroll) -------------------------- */

const PAYROLL_CYCLES = ["weekly", "biweekly", "monthly"] as const;

export const updateHrSettingSchema = z.object({
  payrollCycle: z.enum(PAYROLL_CYCLES).optional(),
  salaryDisbursementDay: z.number().int().min(1).max(28).optional(),
  annualLeaveDays: z.number().int().min(0).max(365).optional(),
  overtimeRate: optionalMoney,
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export type UpdateHrSettingInput = z.infer<typeof updateHrSettingSchema>;

/* Inventory settings (Settings → Inventory) -------------------------------- */

export const updateInventorySettingSchema = z.object({
  trackMedicalEquipment: z.boolean().optional(),
  assetBarcode: z.boolean().optional(),
  lowStockAlert: z.boolean().optional(),
  autoReorder: z.boolean().optional(),
  stockTransferApproval: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export type UpdateInventorySettingInput = z.infer<typeof updateInventorySettingSchema>;

/* Notification settings (Settings → Notification) -------------------------- */

export const updateNotificationSettingSchema = z.object({
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  appointmentNotification: z.boolean().optional(),
  billingNotification: z.boolean().optional(),
  labNotification: z.boolean().optional(),
  followupNotification: z.boolean().optional(),
  paymentNotification: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export type UpdateNotificationSettingInput = z.infer<typeof updateNotificationSettingSchema>;

/* Print & document templates (Settings → Print & Document) ------------------ */

export const PRINT_DOCUMENT_TYPES = [
  "prescription",
  "invoice",
  "discharge_certificate",
  "lab_report",
  "admission_form",
  "employee_id_card",
] as const;

export const createPrintTemplateSchema = z.object({
  documentType: z.enum(PRINT_DOCUMENT_TYPES),
  templateName: z.string().trim().min(1, "templateName is required").max(64),
  header: optionalString(512),
  footer: optionalString(512),
  logo: optionalString(512),
  signature: optionalString(512),
  templateContent: optionalString(8192),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export const updatePrintTemplateSchema = createPrintTemplateSchema.partial();

export type CreatePrintTemplateInput = z.infer<typeof createPrintTemplateSchema>;
export type UpdatePrintTemplateInput = z.infer<typeof updatePrintTemplateSchema>;

/* API & Integration (Settings → API & Integration) -------------------------- */

export const INTEGRATION_TYPES = ["sms", "payment", "email", "lab", "other"] as const;

export const createIntegrationSchema = z.object({
  integrationType: z.enum(INTEGRATION_TYPES),
  providerName: z.string().trim().min(1, "providerName is required").max(128),
  apiUrl: optionalString(512),
  apiKey: optionalString(512),
  secretKey: optionalString(512),
  configuration: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export const updateIntegrationSchema = createIntegrationSchema.partial();

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;

/* Backup & Database (Settings → Backup & Database) -------------------------- */

export const BACKUP_TYPES = ["full", "incremental"] as const;
export const BACKUP_FREQUENCIES = ["hourly", "daily", "weekly", "monthly"] as const;
export const STORAGE_TYPES = ["local", "cloud", "cloud_local"] as const;

export const updateBackupSettingSchema = z.object({
  backupType: z.enum(BACKUP_TYPES).optional(),
  frequency: z.enum(BACKUP_FREQUENCIES).optional(),
  storageType: z.enum(STORAGE_TYPES).optional(),
  storagePath: optionalString(512),
  retentionDays: z.number().int().min(1).max(3650).optional(),
  encryptionEnabled: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export type UpdateBackupSettingInput = z.infer<typeof updateBackupSettingSchema>;

/* Reports (Settings → Reports) ---------------------------------------------- */

export const REPORT_TYPES = [
  "collection",
  "patient_stats",
  "doctor_performance",
  "pharmacy_sales",
  "lab_income",
  "financial",
  "management",
] as const;

export const createReportSettingSchema = z.object({
  reportName: z.string().trim().min(1, "reportName is required").max(128),
  reportType: z.enum(REPORT_TYPES),
  templateId: z.number().int().positive().optional().nullable(),
  showLogo: z.boolean().optional(),
  showHeader: z.boolean().optional(),
  showFooter: z.boolean().optional(),
  showSignature: z.boolean().optional(),
  exportPdf: z.boolean().optional(),
  exportExcel: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export const updateReportSettingSchema = createReportSettingSchema.partial();

export type CreateReportSettingInput = z.infer<typeof createReportSettingSchema>;
export type UpdateReportSettingInput = z.infer<typeof updateReportSettingSchema>;

/* Master Data (Settings → Master Data) -------------------------------------- */

export const masterDataCategorySchema = z.enum(MASTER_DATA_CATEGORIES);

/**
 * The address categories form a hierarchy loaded from the national dataset in
 * `prisma/address-source`. A row is only reachable through the cascading
 * dropdowns when it names its parent, so the lower levels require one. Divisions
 * are top level and take none. The mapping lives in lib/bangladeshAddress.ts so
 * that this schema and the delete guard cannot drift apart.
 */
const needsParent = (category: string): boolean =>
  isAddressCategory(category) && ADDRESS_CATEGORY_PARENT[category] !== null;

const masterDataBaseSchema = z.object({
  category: masterDataCategorySchema,
  label: z.string().trim().min(1, "label is required").max(128),
  // `code` is required on every lookup table now, so it is required here too.
  // Address codes chain the whole parent path, so the longest one generated from
  // the current dataset is 77 characters (a union under a long upazila). The cap
  // matches the column width so this schema can never reject a code the database
  // would have accepted.
  code: z.string().trim().min(1, "code is required").max(191),
  parentCode: z.string().trim().max(191).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export const createMasterDataSchema = masterDataBaseSchema.refine(
  (value) => !needsParent(value.category) || Boolean(value.parentCode),
  {
    message:
      "parentCode is required: a district needs a division, an upazila needs a district, and a union needs an upazila",
    path: ["parentCode"],
  },
);

// Built from the base object because .partial() does not exist on the refined type.
export const updateMasterDataSchema = masterDataBaseSchema.partial();

export type CreateMasterDataInput = z.infer<typeof createMasterDataSchema>;
export type UpdateMasterDataInput = z.infer<typeof updateMasterDataSchema>;

/* System Maintenance (Settings → System Maintenance) ------------------------ */

export const updateSystemMaintenanceSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  cacheEnabled: z.boolean().optional(),
  systemVersion: z.string().trim().max(64).optional().nullable(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export type UpdateSystemMaintenanceInput = z.infer<typeof updateSystemMaintenanceSchema>;