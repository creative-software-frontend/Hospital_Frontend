import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ConflictError, NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import type { AuthUser } from "../../types/auth";
import type {
  CreateIntegrationInput,
  CreatePrintTemplateInput,
  ListSystemSettingsQuery,
  UpdateAccountingSettingInput,
  UpdateBillingSettingInput,
  UpdateEmergencySettingInput,
  UpdateHrSettingInput,
  UpdateInventorySettingInput,
  UpdateIntegrationInput,
  UpdateNotificationSettingInput,
  UpdateIpdSettingInput,
  UpdateLabSettingInput,
  UpdateOpdSettingInput,
  UpdatePatientSettingInput,
  UpdatePharmacySettingInput,
  UpdatePrescriptionSettingInput,
  UpdatePrintTemplateInput,
  UpdateSecuritySettingInput,
  UpsertSystemSettingInput,
} from "./setting.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

/* ---------------------------------------------------------------------------
 * System (general) settings
 * ------------------------------------------------------------------------- */

export async function listSystemSettings(actor: AuthUser, query: ListSystemSettingsQuery) {
  // SUPER_ADMIN may filter by branch; normal users are bound to their own.
  const branchId = isSuperAdmin(actor) ? query.branchId ?? actor.branchId : actor.branchId;

  const settings = await prisma.systemSetting.findMany({
    where: {
      branchId: branchId ?? undefined,
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: [{ settingGroup: "asc" }, { settingKey: "asc" }],
    select: {
      id: true,
      branchId: true,
      settingGroup: true,
      settingKey: true,
      settingValue: true,
      dataType: true,
      isEncrypted: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return settings;
}

export async function upsertSystemSetting(actor: AuthUser, input: UpsertSystemSettingInput) {
  const branchId = isSuperAdmin(actor) ? (input.branchId ?? actor.branchId) : actor.branchId;

  if (branchId == null) {
    throw new NotFoundError("A branch context is required for system settings");
  }

  const data: Record<string, unknown> = {
    settingValue: input.settingValue,
    dataType: input.dataType,
    ...(input.isEncrypted !== undefined ? { isEncrypted: input.isEncrypted } : {}),
    ...(input.status ? { status: input.status } : {}),
  };

  const existing = await prisma.systemSetting.findUnique({
    where: {
      branchId_settingGroup_settingKey: {
        branchId,
        settingGroup: input.settingGroup,
        settingKey: input.settingKey,
      },
    },
  });

  if (existing) {
    const updated = await prisma.systemSetting.update({
      where: { id: existing.id },
      data,
    });
    await writeAuditLog({
      module: "systemSetting",
      action: "update",
      tableName: "SystemSetting",
      recordId: String(existing.id),
      oldValues: { settingValue: existing.settingValue, status: existing.status },
      newValues: { ...data, settingGroup: input.settingGroup, settingKey: input.settingKey },
      user: actor,
      branchId,
    });
    return updated;
  }

  const created = await prisma.systemSetting.create({
    data: {
      branchId,
      settingGroup: input.settingGroup,
      settingKey: input.settingKey,
      settingValue: input.settingValue,
      dataType: input.dataType,
      isEncrypted: input.isEncrypted ?? false,
      status: input.status ?? "active",
    },
  });
  await writeAuditLog({
    module: "systemSetting",
    action: "create",
    tableName: "SystemSetting",
    recordId: String(created.id),
    newValues: { ...created },
    user: actor,
    branchId,
  });
  return created;
}

export async function deleteSystemSetting(actor: AuthUser, id: number) {
  const setting = await prisma.systemSetting.findUnique({ where: { id } });
  if (!setting) {
    throw new NotFoundError("System setting not found");
  }
  await prisma.systemSetting.delete({ where: { id } });
  await writeAuditLog({
    module: "systemSetting",
    action: "delete",
    tableName: "SystemSetting",
    recordId: String(id),
    oldValues: { settingGroup: setting.settingGroup, settingKey: setting.settingKey },
    user: actor,
    branchId: setting.branchId ?? undefined,
  });
}

/* ---------------------------------------------------------------------------
 * Security settings
 * ------------------------------------------------------------------------- */

export async function getSecuritySetting() {
  let setting = await prisma.securitySetting.findFirst({ orderBy: { id: "asc" } });
  if (!setting) {
    setting = await prisma.securitySetting.create({
      data: {
        passwordMinLength: 8,
        passwordExpiryDays: 90,
        maxLoginAttempts: 5,
        sessionTimeout: 30,
        twoFactorEnabled: false,
        ipRestrictionEnabled: false,
        deviceRestrictionEnabled: false,
        auditLogEnabled: true,
        status: "active",
      },
    });
  }
  return setting;
}

export async function updateSecuritySetting(actor: AuthUser, input: UpdateSecuritySettingInput) {
  const current = await getSecuritySetting();

  const updated = await prisma.securitySetting.update({
    where: { id: current.id },
    data: { ...input },
  });

  await writeAuditLog({
    module: "securitySetting",
    action: "update",
    tableName: "SecuritySetting",
    recordId: String(current.id),
    oldValues: {
      passwordMinLength: current.passwordMinLength,
      sessionTimeout: current.sessionTimeout,
      twoFactorEnabled: current.twoFactorEnabled,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

/* ---------------------------------------------------------------------------
 * Billing settings
 * ------------------------------------------------------------------------- */

export async function getBillingSetting(actor: AuthUser) {
  return findOrCreateBranchSetting({
    findFirst: () =>
      prisma.billingSetting.findFirst({ where: { branchId: actor.branchId }, orderBy: { id: "asc" } }),
    create: () =>
      prisma.billingSetting.create({
        data: {
          branchId: actor.branchId,
          invoicePrefix: "INV-",
          invoiceStartNumber: 1,
          receiptPrefix: "RCT-",
          taxPercent: null,
          serviceChargePercent: null,
          discountEnabled: true,
          partialPaymentEnabled: true,
          refundEnabled: true,
          duePaymentEnabled: true,
          status: "active",
        },
      }),
  });
}

export async function updateBillingSetting(actor: AuthUser, input: UpdateBillingSettingInput) {
  const current = await getBillingSetting(actor);
  const updated = await prisma.billingSetting.update({
    where: { id: current.id },
    data: { ...input },
  });
  await writeAuditLog({
    module: "billingSetting",
    action: "update",
    tableName: "BillingSetting",
    recordId: String(current.id),
    oldValues: {
      invoicePrefix: current.invoicePrefix,
      invoiceStartNumber: current.invoiceStartNumber,
      taxPercent: current.taxPercent,
      discountEnabled: current.discountEnabled,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

/* ---------------------------------------------------------------------------
 * Patient configuration settings
 * ------------------------------------------------------------------------- */

export async function getPatientSetting(actor: AuthUser) {
  let setting = await prisma.patientSetting.findFirst({
    where: { branchId: actor.branchId },
    orderBy: { id: "asc" },
  });
  if (!setting) {
    setting = await prisma.patientSetting.create({
      data: {
        branchId: actor.branchId,
        patientIdPrefix: "PT-",
        autoGenerateId: true,
        defaultPatientType: "NEW",
        requireGuardian: "MINORS_ONLY",
        duplicateDetection: true,
        phoneRequired: true,
        emailRequired: false,
        status: "active",
      },
    });
  }
  return setting;
}

export async function updatePatientSetting(actor: AuthUser, input: UpdatePatientSettingInput) {
  const current = await getPatientSetting(actor);

  const updated = await prisma.patientSetting.update({
    where: { id: current.id },
    data: { ...input },
  });

  await writeAuditLog({
    module: "patientSetting",
    action: "update",
    tableName: "PatientSetting",
    recordId: String(current.id),
    oldValues: {
      patientIdPrefix: current.patientIdPrefix,
      autoGenerateId: current.autoGenerateId,
      defaultPatientType: current.defaultPatientType,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });

  return updated;
}

/* ---------------------------------------------------------------------------
 * Clinical settings (OPD / IPD / Emergency / Prescription)
 * ------------------------------------------------------------------------- */

async function findOrCreateBranchSetting<T extends { id: number; branchId: number }>(args: {
  findFirst: () => Promise<T | null>;
  create: () => Promise<T>;
}): Promise<T> {
  let setting = await args.findFirst();
  if (!setting) {
    setting = await args.create();
  }
  return setting;
}

export async function getOpdSetting(actor: AuthUser) {
  return findOrCreateBranchSetting({
    findFirst: () => prisma.opdSetting.findFirst({ where: { branchId: actor.branchId }, orderBy: { id: "asc" } }),
    create: () =>
      prisma.opdSetting.create({
        data: {
          branchId: actor.branchId,
          registrationFee: null,
          consultationFee: null,
          followupDays: 14,
          appointmentDuration: 15,
          queueEnabled: true,
          prescriptionEnabled: true,
          status: "active",
        },
      }),
  });
}

export async function updateOpdSetting(actor: AuthUser, input: UpdateOpdSettingInput) {
  const current = await getOpdSetting(actor);
  const updated = await prisma.opdSetting.update({ where: { id: current.id }, data: { ...input } });
  await writeAuditLog({
    module: "opdSetting",
    action: "update",
    tableName: "OpdSetting",
    recordId: String(current.id),
    oldValues: {
      registrationFee: current.registrationFee,
      consultationFee: current.consultationFee,
      queueEnabled: current.queueEnabled,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

export async function getIpdSetting(actor: AuthUser) {
  return findOrCreateBranchSetting({
    findFirst: () => prisma.ipdSetting.findFirst({ where: { branchId: actor.branchId }, orderBy: { id: "asc" } }),
    create: () =>
      prisma.ipdSetting.create({
        data: {
          branchId: actor.branchId,
          admissionFee: null,
          dischargeFee: null,
          bedCharge: null,
          nursingCharge: null,
          serviceCharge: null,
          status: "active",
        },
      }),
  });
}

export async function updateIpdSetting(actor: AuthUser, input: UpdateIpdSettingInput) {
  const current = await getIpdSetting(actor);
  const updated = await prisma.ipdSetting.update({ where: { id: current.id }, data: { ...input } });
  await writeAuditLog({
    module: "ipdSetting",
    action: "update",
    tableName: "IpdSetting",
    recordId: String(current.id),
    oldValues: { admissionFee: current.admissionFee, bedCharge: current.bedCharge },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

export async function getEmergencySetting(actor: AuthUser) {
  return findOrCreateBranchSetting({
    findFirst: () =>
      prisma.emergencySetting.findFirst({ where: { branchId: actor.branchId }, orderBy: { id: "asc" } }),
    create: () =>
      prisma.emergencySetting.create({
        data: {
          branchId: actor.branchId,
          registrationFee: null,
          consultationFee: null,
          serviceCharge: null,
          triageEnabled: true,
          status: "active",
        },
      }),
  });
}

export async function updateEmergencySetting(actor: AuthUser, input: UpdateEmergencySettingInput) {
  const current = await getEmergencySetting(actor);
  const updated = await prisma.emergencySetting.update({ where: { id: current.id }, data: { ...input } });
  await writeAuditLog({
    module: "emergencySetting",
    action: "update",
    tableName: "EmergencySetting",
    recordId: String(current.id),
    oldValues: {
      registrationFee: current.registrationFee,
      consultationFee: current.consultationFee,
      triageEnabled: current.triageEnabled,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

export async function getPrescriptionSetting(actor: AuthUser) {
  return findOrCreateBranchSetting({
    findFirst: () =>
      prisma.prescriptionSetting.findFirst({ where: { branchId: actor.branchId }, orderBy: { id: "asc" } }),
    create: () =>
      prisma.prescriptionSetting.create({
        data: {
          branchId: actor.branchId,
          showPatientHistory: true,
          showDiagnosis: true,
          showMedicine: true,
          showDosage: true,
          showInstruction: true,
          showDoctorSignature: true,
          showQrCode: false,
          status: "active",
        },
      }),
  });
}

export async function updatePrescriptionSetting(
  actor: AuthUser,
  input: UpdatePrescriptionSettingInput,
) {
  const current = await getPrescriptionSetting(actor);
  const updated = await prisma.prescriptionSetting.update({
    where: { id: current.id },
    data: { ...input },
  });
  await writeAuditLog({
    module: "prescriptionSetting",
    action: "update",
    tableName: "PrescriptionSetting",
    recordId: String(current.id),
    oldValues: {
      showDiagnosis: current.showDiagnosis,
      showMedicine: current.showMedicine,
      showDoctorSignature: current.showDoctorSignature,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

/* ---------------------------------------------------------------------------
 * Pharmacy settings
 * ------------------------------------------------------------------------- */

export async function getPharmacySetting(actor: AuthUser) {
  return findOrCreateBranchSetting({
    findFirst: () =>
      prisma.pharmacySetting.findFirst({ where: { branchId: actor.branchId }, orderBy: { id: "asc" } }),
    create: () =>
      prisma.pharmacySetting.create({
        data: {
          branchId: actor.branchId,
          taxPercent: null,
          defaultDiscount: null,
          expiryAlertDays: 30,
          lowStockAlert: true,
          barcodeEnabled: true,
          batchEnabled: true,
          status: "active",
        },
      }),
  });
}

export async function updatePharmacySetting(actor: AuthUser, input: UpdatePharmacySettingInput) {
  const current = await getPharmacySetting(actor);
  const updated = await prisma.pharmacySetting.update({ where: { id: current.id }, data: { ...input } });
  await writeAuditLog({
    module: "pharmacySetting",
    action: "update",
    tableName: "PharmacySetting",
    recordId: String(current.id),
    oldValues: {
      taxPercent: current.taxPercent,
      defaultDiscount: current.defaultDiscount,
      expiryAlertDays: current.expiryAlertDays,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

/* ---------------------------------------------------------------------------
 * Laboratory settings
 * ------------------------------------------------------------------------- */

export async function getLabSetting(actor: AuthUser) {
  return findOrCreateBranchSetting({
    findFirst: () =>
      prisma.labSetting.findFirst({ where: { branchId: actor.branchId }, orderBy: { id: "asc" } }),
    create: () =>
      prisma.labSetting.create({
        data: {
          branchId: actor.branchId,
          sampleTrackingEnabled: true,
          barcodeEnabled: true,
          onlineReportEnabled: true,
          reportApprovalRequired: false,
          defaultReportTemplate: null,
          status: "active",
        },
      }),
  });
}

export async function updateLabSetting(actor: AuthUser, input: UpdateLabSettingInput) {
  const current = await getLabSetting(actor);
  const updated = await prisma.labSetting.update({ where: { id: current.id }, data: { ...input } });
  await writeAuditLog({
    module: "labSetting",
    action: "update",
    tableName: "LabSetting",
    recordId: String(current.id),
    oldValues: {
      sampleTrackingEnabled: current.sampleTrackingEnabled,
      barcodeEnabled: current.barcodeEnabled,
      reportApprovalRequired: current.reportApprovalRequired,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

/* ---------------------------------------------------------------------------
 * Accounting settings
 * ------------------------------------------------------------------------- */

export async function getAccountingSetting(actor: AuthUser) {
  return findOrCreateBranchSetting({
    findFirst: () =>
      prisma.accountingSetting.findFirst({
        where: { branchId: actor.branchId },
        orderBy: { id: "asc" },
      }),
    create: () =>
      prisma.accountingSetting.create({
        data: {
          branchId: actor.branchId,
          fiscalYear: "July 2025 - June 2026",
          baseCurrency: "BDT",
          chartOfAccounts: "Hospital Standard",
          autoPostToLedger: true,
          trialBalanceFrequency: "monthly",
          voucherEnabled: true,
          status: "active",
        },
      }),
  });
}

export async function updateAccountingSetting(actor: AuthUser, input: UpdateAccountingSettingInput) {
  const current = await getAccountingSetting(actor);
  const updated = await prisma.accountingSetting.update({
    where: { id: current.id },
    data: { ...input },
  });
  await writeAuditLog({
    module: "accountingSetting",
    action: "update",
    tableName: "AccountingSetting",
    recordId: String(current.id),
    oldValues: {
      fiscalYear: current.fiscalYear,
      baseCurrency: current.baseCurrency,
      autoPostToLedger: current.autoPostToLedger,
      trialBalanceFrequency: current.trialBalanceFrequency,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

/* ---------------------------------------------------------------------------
 * HR & Payroll settings
 * ------------------------------------------------------------------------- */

export async function getHrSetting(actor: AuthUser) {
  return findOrCreateBranchSetting({
    findFirst: () =>
      prisma.hrSetting.findFirst({ where: { branchId: actor.branchId }, orderBy: { id: "asc" } }),
    create: () =>
      prisma.hrSetting.create({
        data: {
          branchId: actor.branchId,
          payrollCycle: "monthly",
          salaryDisbursementDay: 1,
          annualLeaveDays: 18,
          overtimeRate: null,
          status: "active",
        },
      }),
  });
}

export async function updateHrSetting(actor: AuthUser, input: UpdateHrSettingInput) {
  const current = await getHrSetting(actor);
  const updated = await prisma.hrSetting.update({ where: { id: current.id }, data: { ...input } });
  await writeAuditLog({
    module: "hrSetting",
    action: "update",
    tableName: "HrSetting",
    recordId: String(current.id),
    oldValues: {
      payrollCycle: current.payrollCycle,
      salaryDisbursementDay: current.salaryDisbursementDay,
      annualLeaveDays: current.annualLeaveDays,
      overtimeRate: current.overtimeRate,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

/* ---------------------------------------------------------------------------
 * Inventory settings
 * ------------------------------------------------------------------------- */

export async function getInventorySetting(actor: AuthUser) {
  return findOrCreateBranchSetting({
    findFirst: () =>
      prisma.inventorySetting.findFirst({
        where: { branchId: actor.branchId },
        orderBy: { id: "asc" },
      }),
    create: () =>
      prisma.inventorySetting.create({
        data: {
          branchId: actor.branchId,
          trackMedicalEquipment: true,
          assetBarcode: true,
          lowStockAlert: true,
          autoReorder: true,
          stockTransferApproval: true,
          status: "active",
        },
      }),
  });
}

export async function updateInventorySetting(actor: AuthUser, input: UpdateInventorySettingInput) {
  const current = await getInventorySetting(actor);
  const updated = await prisma.inventorySetting.update({
    where: { id: current.id },
    data: { ...input },
  });
  await writeAuditLog({
    module: "inventorySetting",
    action: "update",
    tableName: "InventorySetting",
    recordId: String(current.id),
    oldValues: {
      trackMedicalEquipment: current.trackMedicalEquipment,
      assetBarcode: current.assetBarcode,
      autoReorder: current.autoReorder,
      stockTransferApproval: current.stockTransferApproval,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

/* ---------------------------------------------------------------------------
 * Notification settings
 * ------------------------------------------------------------------------- */

export async function getNotificationSetting(actor: AuthUser) {
  return findOrCreateBranchSetting({
    findFirst: () =>
      prisma.notificationSetting.findFirst({
        where: { branchId: actor.branchId },
        orderBy: { id: "asc" },
      }),
    create: () =>
      prisma.notificationSetting.create({
        data: {
          branchId: actor.branchId,
          smsEnabled: false,
          emailEnabled: false,
          whatsappEnabled: false,
          appointmentNotification: true,
          billingNotification: true,
          labNotification: true,
          followupNotification: true,
          paymentNotification: true,
          status: "active",
        },
      }),
  });
}

export async function updateNotificationSetting(
  actor: AuthUser,
  input: UpdateNotificationSettingInput,
) {
  const current = await getNotificationSetting(actor);
  const updated = await prisma.notificationSetting.update({
    where: { id: current.id },
    data: { ...input },
  });
  await writeAuditLog({
    module: "notificationSetting",
    action: "update",
    tableName: "NotificationSetting",
    recordId: String(current.id),
    oldValues: {
      smsEnabled: current.smsEnabled,
      emailEnabled: current.emailEnabled,
      appointmentNotification: current.appointmentNotification,
      billingNotification: current.billingNotification,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

/* ---------------------------------------------------------------------------
 * Print & document templates
 * ------------------------------------------------------------------------- */

export async function listPrintTemplates(actor: AuthUser) {
  return prisma.documentTemplate.findMany({
    where: { branchId: actor.branchId },
    orderBy: [{ documentType: "asc" }, { templateName: "asc" }],
    select: {
      id: true,
      branchId: true,
      documentType: true,
      templateName: true,
      header: true,
      footer: true,
      logo: true,
      signature: true,
      templateContent: true,
      status: true,
    },
  });
}

export async function createPrintTemplate(actor: AuthUser, input: CreatePrintTemplateInput) {
  const existing = await prisma.documentTemplate.findUnique({
    where: {
      branchId_documentType_templateName: {
        branchId: actor.branchId,
        documentType: input.documentType,
        templateName: input.templateName,
      },
    },
  });
  if (existing) {
    throw new ConflictError(
      `A "${input.templateName}" template already exists for ${input.documentType}`,
    );
  }

  const created = await prisma.documentTemplate.create({
    data: {
      branchId: actor.branchId,
      documentType: input.documentType,
      templateName: input.templateName,
      header: input.header,
      footer: input.footer,
      logo: input.logo,
      signature: input.signature,
      templateContent: input.templateContent,
      status: input.status ?? "active",
    },
  });

  await writeAuditLog({
    module: "printTemplate",
    action: "create",
    tableName: "DocumentTemplate",
    recordId: String(created.id),
    newValues: {
      documentType: created.documentType,
      templateName: created.templateName,
      status: created.status,
    },
    user: actor,
    branchId: actor.branchId,
  });
  return created;
}

export async function updatePrintTemplate(actor: AuthUser, id: number, input: UpdatePrintTemplateInput) {
  const current = await prisma.documentTemplate.findFirst({
    where: { id, branchId: actor.branchId },
  });
  if (!current) {
    throw new NotFoundError("Print template not found");
  }

  const documentType = input.documentType ?? current.documentType;
  const templateName = input.templateName ?? current.templateName;
  const duplicate = await prisma.documentTemplate.findFirst({
    where: {
      branchId: actor.branchId,
      documentType,
      templateName,
      NOT: { id },
    },
  });
  if (duplicate) {
    throw new ConflictError(
      `A "${templateName}" template already exists for ${documentType}`,
    );
  }

  const updated = await prisma.documentTemplate.update({
    where: { id },
    data: { ...input },
  });

  await writeAuditLog({
    module: "printTemplate",
    action: "update",
    tableName: "DocumentTemplate",
    recordId: String(id),
    oldValues: {
      documentType: current.documentType,
      templateName: current.templateName,
      status: current.status,
    },
    newValues: { ...input },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

export async function deletePrintTemplate(actor: AuthUser, id: number) {
  const current = await prisma.documentTemplate.findFirst({
    where: { id, branchId: actor.branchId },
  });
  if (!current) {
    throw new NotFoundError("Print template not found");
  }

  await prisma.documentTemplate.delete({ where: { id } });

  await writeAuditLog({
    module: "printTemplate",
    action: "delete",
    tableName: "DocumentTemplate",
    recordId: String(id),
    oldValues: {
      documentType: current.documentType,
      templateName: current.templateName,
    },
    user: actor,
    branchId: actor.branchId,
  });
}

/* ---------------------------------------------------------------------------
 * API & Integration
 * ------------------------------------------------------------------------- */

function toIntegrationResponse(
  row: {
    id: number;
    branchId: number;
    integrationType: string;
    providerName: string;
    apiUrl: string | null;
    apiKey: string | null;
    secretKey: string | null;
    configuration: Prisma.JsonValue | null;
    status: string;
  },
): {
  id: number;
  branchId: number;
  integrationType: string;
  providerName: string;
  apiUrl: string | null;
  apiKeyMasked: string | null;
  hasSecretKey: boolean;
  configuration: Prisma.JsonValue | null;
  status: string;
} {
  return {
    id: row.id,
    branchId: row.branchId,
    integrationType: row.integrationType,
    providerName: row.providerName,
    apiUrl: row.apiUrl,
    apiKeyMasked: row.apiKey ? `••••${row.apiKey.slice(-4)}` : null,
    hasSecretKey: !!row.secretKey,
    configuration: row.configuration,
    status: row.status,
  };
}

export async function listIntegrations(actor: AuthUser) {
  const rows = await prisma.integration.findMany({
    where: { branchId: actor.branchId },
    orderBy: [{ integrationType: "asc" }, { providerName: "asc" }],
  });
  return rows.map(toIntegrationResponse);
}

export async function createIntegration(actor: AuthUser, input: CreateIntegrationInput) {
  const created = await prisma.integration.create({
    data: {
      branchId: actor.branchId,
      integrationType: input.integrationType,
      providerName: input.providerName,
      apiUrl: input.apiUrl,
      apiKey: input.apiKey,
      secretKey: input.secretKey,
      configuration: input.configuration as Prisma.InputJsonValue | undefined,
      status: input.status ?? "active",
    },
  });

  await writeAuditLog({
    module: "integration",
    action: "create",
    tableName: "Integration",
    recordId: String(created.id),
    newValues: {
      integrationType: created.integrationType,
      providerName: created.providerName,
      status: created.status,
    },
    user: actor,
    branchId: actor.branchId,
  });
  return toIntegrationResponse(created);
}

export async function updateIntegration(actor: AuthUser, id: number, input: UpdateIntegrationInput) {
  const current = await prisma.integration.findFirst({ where: { id, branchId: actor.branchId } });
  if (!current) {
    throw new NotFoundError("Integration not found");
  }

  const data: Prisma.IntegrationUncheckedUpdateInput = {
    ...(input.integrationType ? { integrationType: input.integrationType } : {}),
    ...(input.providerName ? { providerName: input.providerName } : {}),
    ...(input.apiUrl !== undefined ? { apiUrl: input.apiUrl } : {}),
    ...(input.apiKey !== undefined ? { apiKey: input.apiKey } : {}),
    ...(input.secretKey !== undefined ? { secretKey: input.secretKey } : {}),
    ...(input.configuration !== undefined
      ? { configuration: input.configuration as Prisma.InputJsonValue }
      : {}),
    ...(input.status ? { status: input.status } : {}),
  };

  const updated = await prisma.integration.update({ where: { id }, data });

  await writeAuditLog({
    module: "integration",
    action: "update",
    tableName: "Integration",
    recordId: String(id),
    oldValues: {
      integrationType: current.integrationType,
      providerName: current.providerName,
      status: current.status,
    },
    newValues: {
      ...(input.integrationType ? { integrationType: input.integrationType } : {}),
      ...(input.providerName ? { providerName: input.providerName } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    user: actor,
    branchId: actor.branchId,
  });
  return toIntegrationResponse(updated);
}

export async function deleteIntegration(actor: AuthUser, id: number) {
  const current = await prisma.integration.findFirst({ where: { id, branchId: actor.branchId } });
  if (!current) {
    throw new NotFoundError("Integration not found");
  }

  await prisma.integration.delete({ where: { id } });

  await writeAuditLog({
    module: "integration",
    action: "delete",
    tableName: "Integration",
    recordId: String(id),
    oldValues: {
      integrationType: current.integrationType,
      providerName: current.providerName,
    },
    user: actor,
    branchId: actor.branchId,
  });
}

export async function testIntegration(actor: AuthUser, id: number) {
  const current = await prisma.integration.findFirst({ where: { id, branchId: actor.branchId } });
  if (!current) {
    throw new NotFoundError("Integration not found");
  }

  await writeAuditLog({
    module: "integration",
    action: "test",
    tableName: "Integration",
    recordId: String(id),
    newValues: { providerName: current.providerName, ...(current.apiUrl ? { apiUrl: current.apiUrl } : {}) },
    user: actor,
    branchId: actor.branchId,
  });

  if (current.status !== "active") {
    return {
      success: false,
      message: `Integration "${current.providerName}" is not active. Enable it before testing.`,
      latencyMs: 0,
    };
  }
  if (!current.apiUrl && !current.apiKey) {
    return {
      success: false,
      message: `Missing connection details for "${current.providerName}". Provide an API URL or key first.`,
      latencyMs: 0,
    };
  }
  return {
    success: true,
    message: `Connection configuration for "${current.providerName}" is valid (no live request performed).`,
    latencyMs: 0,
  };
}