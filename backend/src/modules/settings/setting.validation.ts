import { z } from "zod";

export const SETTING_STATUS_VALUES = ["active", "inactive"] as const;

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .or(z.literal("").transform(() => undefined));

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

/* Security settings -------------------------------------------------------- */

export const updateSecuritySettingSchema = z.object({
  passwordMinLength: z.number().int().min(4).max(64).optional(),
  passwordExpiryDays: z.number().int().min(0).max(3650).optional(),
  maxLoginAttempts: z.number().int().min(1).max(50).optional(),
  sessionTimeout: z.number().int().min(1).max(1440).optional(),
  twoFactorEnabled: z.boolean().optional(),
  ipRestrictionEnabled: z.boolean().optional(),
  deviceRestrictionEnabled: z.boolean().optional(),
  auditLogEnabled: z.boolean().optional(),
  status: z.enum(SETTING_STATUS_VALUES).optional(),
});

export type ListSystemSettingsQuery = z.infer<typeof listSystemSettingsQuerySchema>;
export type UpsertSystemSettingInput = z.infer<typeof upsertSystemSettingSchema>;
export type UpdateSecuritySettingInput = z.infer<typeof updateSecuritySettingSchema>;

/* Patient configuration settings ------------------------------------------- */

export const updatePatientSettingSchema = z.object({
  patientIdPrefix: z.string().trim().max(16).optional(),
  autoGenerateId: z.boolean().optional(),
  defaultPatientType: z.string().trim().max(32).optional(),
  requireGuardian: z.enum(["NEVER", "MINORS_ONLY", "ALWAYS"]).optional(),
  duplicateDetection: z.boolean().optional(),
  phoneRequired: z.boolean().optional(),
  emailRequired: z.boolean().optional(),
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