import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ConflictError, NotFoundError, ValidationError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { revealPublicAsset } from "../../utils/revealPath";
import { BLOOD_GROUP_VALUES } from "../patients/patient.validation";
import { ADDRESS_CATEGORY, isAddressCategory } from "../../lib/bangladeshAddress";
import {
  APP_OWNED_CATEGORIES,
  LOOKUP_SPECS,
  MASTER_DATA_CATEGORIES,
  isMasterDataCategory,
  lookupSpec,
} from "../../lib/masterDataRegistry";
import type { MasterDataCategory, LookupSpec } from "../../lib/masterDataRegistry";
import {
  branchScope,
  lookupDelegate,
  lookupSelect,
  toLookupRow,
} from "../../lib/lookupDelegate";
import type { LookupRow } from "../../lib/lookupDelegate";
import type { AuthUser } from "../../types/auth";
import type {
  CreateIntegrationInput,
  CreateMasterDataInput,
  CreatePrintTemplateInput,
  CreateReportSettingInput,
  ListSystemSettingsQuery,
  RevealAssetPathInput,
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
  UpdateReportSettingInput,
  UpdateMasterDataInput,
  UpdateLocalizationSettingInput,
  UpdateSystemMaintenanceInput,
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
 * Local assets
 * ------------------------------------------------------------------------- */

/**
 * Opens a file under the Next.js `public/` folder in the OS file manager. The
 * path is confined to that folder and the whole thing is refused in production;
 * see utils/revealPath.ts for why.
 */
export async function revealAssetPath(actor: AuthUser, input: RevealAssetPathInput) {
  const revealed = revealPublicAsset(input.path);

  await writeAuditLog({
    module: "systemSetting",
    action: "reveal",
    tableName: "SystemSetting",
    newValues: { requestedPath: input.path, folder: revealed.folder },
    user: actor,
  });

  return revealed;
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
        whatsappRequired: false,
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
      phoneRequired: current.phoneRequired,
      emailRequired: current.emailRequired,
      whatsappRequired: current.whatsappRequired,
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


/* ---------------------------------------------------------------------------
 * Reports
 * ------------------------------------------------------------------------- */

const REPORT_TEMPLATE_SELECT = {
  select: { id: true, documentType: true, templateName: true },
} as const;

async function assertTemplateInBranch(actor: AuthUser, templateId: number | null | undefined) {
  if (templateId == null) return null;
  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, branchId: actor.branchId },
    select: { id: true },
  });
  if (!template) {
    throw new NotFoundError("Selected print template not found in this branch");
  }
  return template.id;
}

export async function listReportSettings(actor: AuthUser) {
  return prisma.reportSetting.findMany({
    where: { branchId: actor.branchId },
    orderBy: { reportName: "asc" },
    include: {
      template: REPORT_TEMPLATE_SELECT,
    },
  });
}

export async function createReportSetting(actor: AuthUser, input: CreateReportSettingInput) {
  await assertTemplateInBranch(actor, input.templateId);

  const created = await prisma.reportSetting.create({
    data: {
      branchId: actor.branchId,
      reportName: input.reportName,
      reportType: input.reportType,
      templateId: input.templateId ?? null,
      showLogo: input.showLogo ?? true,
      showHeader: input.showHeader ?? true,
      showFooter: input.showFooter ?? true,
      showSignature: input.showSignature ?? true,
      exportPdf: input.exportPdf ?? true,
      exportExcel: input.exportExcel ?? true,
      status: input.status ?? "active",
    },
    include: { template: REPORT_TEMPLATE_SELECT },
  });

  await writeAuditLog({
    module: "reportSetting",
    action: "create",
    tableName: "ReportSetting",
    recordId: String(created.id),
    newValues: {
      reportName: created.reportName,
      reportType: created.reportType,
      status: created.status,
    },
    user: actor,
    branchId: actor.branchId,
  });
  return created;
}

export async function updateReportSetting(actor: AuthUser, id: number, input: UpdateReportSettingInput) {
  const current = await prisma.reportSetting.findFirst({ where: { id, branchId: actor.branchId } });
  if (!current) {
    throw new NotFoundError("Report setting not found");
  }

  await assertTemplateInBranch(actor, input.templateId);

  const updated = await prisma.reportSetting.update({
    where: { id },
    data: { ...input },
    include: { template: REPORT_TEMPLATE_SELECT },
  });

  await writeAuditLog({
    module: "reportSetting",
    action: "update",
    tableName: "ReportSetting",
    recordId: String(id),
    oldValues: {
      reportName: current.reportName,
      reportType: current.reportType,
      templateId: current.templateId,
      status: current.status,
    },
    newValues: {
      ...(input.reportName ? { reportName: input.reportName } : {}),
      ...(input.reportType ? { reportType: input.reportType } : {}),
      ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

export async function deleteReportSetting(actor: AuthUser, id: number) {
  const current = await prisma.reportSetting.findFirst({ where: { id, branchId: actor.branchId } });
  if (!current) {
    throw new NotFoundError("Report setting not found");
  }

  await prisma.reportSetting.delete({ where: { id } });

  await writeAuditLog({
    module: "reportSetting",
    action: "delete",
    tableName: "ReportSetting",
    recordId: String(id),
    oldValues: {
      reportName: current.reportName,
      reportType: current.reportType,
    },
    user: actor,
    branchId: actor.branchId,
  });
}

/* ---------------------------------------------------------------------------
 * Master Data
 *
 * Every lookup list is its own table now (see lib/masterDataRegistry.ts). The
 * service layer still speaks the old flat, category-keyed contract so the API and
 * UI are unchanged, but `label` on the wire maps to the `name` column and
 * `parentCode` is read back from the parent foreign key.
 * ------------------------------------------------------------------------- */

/** The shape the API returns, which is what the frontend still consumes. */
export interface MasterDataListItem {
  id: number;
  branchId: number | null;
  category: MasterDataCategory;
  label: string;
  code: string;
  parentCode: string | null;
  sortOrder: number;
  status: string;
  bnName: string | null;
  lat: number | null;
  lon: number | null;
  url: string | null;
}

const toListItem = (category: MasterDataCategory, row: LookupRow): MasterDataListItem => ({
  id: row.id,
  branchId: row.branchId,
  category,
  label: row.name,
  code: row.code,
  parentCode: row.parentCode,
  sortOrder: row.sortOrder,
  status: row.status,
  bnName: row.bnName,
  lat: row.lat,
  lon: row.lon,
  url: row.url,
});

/**
 * Lists one category, or the website-managed categories when none is given. The
 * admin screen asks for all editable lists and filters client-side. Address levels
 * are deliberately not part of the default: they are SQL-imported and never shown
 * on that screen, and including them would ship 15,000 rows to the browser.
 */
export async function listMasterData(
  actor: AuthUser,
  category?: string,
): Promise<MasterDataListItem[]> {
  let categories: readonly MasterDataCategory[];
  if (category === undefined) {
    categories = APP_OWNED_CATEGORIES;
  } else {
    if (!isMasterDataCategory(category)) {
      throw new ValidationError(`Unknown master data category "${category}"`);
    }
    categories = [category];
  }

  const perCategory = await Promise.all(
    categories.map(async (cat) => {
      const spec = lookupSpec(cat);
      const raw = await lookupDelegate(spec.model).findMany({
        where: branchScope(spec, actor.branchId),
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: lookupSelect(spec),
      });
      return raw.map((r) => toListItem(cat, toLookupRow(spec, r as never)));
    }),
  );

  const merged = perCategory.flat();
  // `category` is the registry's own order, which is what the admin sidebar uses.
  const order = new Map(MASTER_DATA_CATEGORIES.map((c, i) => [c, i]));
  return merged.sort(
    (a, b) =>
      (order.get(a.category) ?? 0) - (order.get(b.category) ?? 0) ||
      a.sortOrder - b.sortOrder ||
      a.label.localeCompare(b.label),
  );
}

/**
 * Categories whose values are stored in a database ENUM column. A lookup row can
 * only offer codes the column accepts, so an out-of-date or hand-edited list can
 * never make a record unsavable: illegal codes are dropped and, if that leaves
 * nothing usable, the enum itself becomes the source of truth.
 */
const ENUM_BACKED_CATEGORIES: Record<
  string,
  { values: readonly string[]; labels: Record<string, string> }
> = {
  blood_groups: {
    values: BLOOD_GROUP_VALUES,
    labels: {
      A_POS: "A+",
      A_NEG: "A-",
      B_POS: "B+",
      B_NEG: "B-",
      AB_POS: "AB+",
      AB_NEG: "AB-",
      O_POS: "O+",
      O_NEG: "O-",
    },
  },
};

export interface MasterDataOption {
  code: string;
  label: string;
  sortOrder: number;
  /** True when the option comes from the enum fallback rather than the table. */
  fallback: boolean;
}

/**
 * Resolves a category into dropdown options. This is the single place other
 * features read from, so the lookup tables become authoritative for the UI. For
 * enum-backed categories the value set is still guaranteed to be writable.
 */
export async function listMasterDataOptions(
  actor: AuthUser,
  category: string,
): Promise<MasterDataOption[]> {
  if (!isMasterDataCategory(category)) {
    throw new ValidationError(`Unknown master data category "${category}"`);
  }
  const spec = lookupSpec(category);
  const raw = await lookupDelegate(spec.model).findMany({
    where: { ...branchScope(spec, actor.branchId), status: "active" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { code: true, name: true, sortOrder: true },
  });

  const enumSpec = ENUM_BACKED_CATEGORIES[category];

  const usable: MasterDataOption[] = [];
  for (const r of raw) {
    const code = r.code as string;
    const label = r.name as string;
    const sortOrder = (r.sortOrder as number | null) ?? 0;
    if (enumSpec) {
      // Enum-backed columns are strict: only a code the column accepts can be
      // offered, so the table can never produce an unsavable value.
      if (!(enumSpec.values as readonly string[]).includes(code)) continue;
      usable.push({ code, label, sortOrder, fallback: false });
    } else {
      usable.push({ code, label, sortOrder, fallback: false });
    }
  }

  // Empty (or entirely invalid) master data must not leave a dropdown blank.
  if (usable.length === 0 && enumSpec) {
    return enumSpec.values.map((value, index) => ({
      code: value,
      label: enumSpec.labels[value] ?? value,
      sortOrder: index,
      fallback: true,
    }));
  }

  return usable;
}

/**
 * The address hierarchy is reference data loaded from the national dataset, not
 * something an admin maintains, so the write endpoints refuse it outright.
 * Hiding the buttons in the UI is not enough on its own: a stray request would
 * otherwise add a place that immediately shows up in every patient's address
 * dropdown, and an edit could break the codes the cascade depends on.
 */
function assertAddressDataNotEditable(category: string): void {
  if (!isAddressCategory(category)) return;
  throw new ValidationError(
    `"${category}" is national address data and cannot be added, edited or deleted here. ` +
      `It is loaded from prisma/address-source; to change it, update the dumps and re-import ` +
      `sql/address-master-data.sql (or run "npm run seed:address").`,
  );
}

/* ---------------------------------------------------------------------------
 * Bangladesh address cascade (division -> district -> upazila -> union)
 *
 * Read from the address tables rather than the vendored dataset directly, so every
 * value the UI shows is a row in the database. `sql/address-master-data.sql` is
 * what loads the national data in.
 *
 * Each level is joined to its parent through a real foreign key, so a district can
 * only ever sit under a division that exists.
 *
 * The upazila level doubles as the thana: the published dataset has no separate
 * metropolitan thanas, so the locality dropdown lists upazilas and the result is
 * stored in `Patient.upazila`. `Patient.thana` is left for records written before
 * that change.
 * ------------------------------------------------------------------------- */

export interface AddressChoice {
  code: string;
  label: string;
  /** Bengali name from the national dataset. */
  bnName: string | null;
  /** Present for the locality level, which is always an upazila now. */
  type?: "upazila";
}

async function addressChildren(
  actor: AuthUser,
  category: string,
  parentCode?: string,
): Promise<AddressChoice[]> {
  const spec = lookupSpec(category);
  if (!spec.address) {
    throw new ValidationError(`"${category}" is not an address level`);
  }
  // A level that has a parent cannot be listed without one: its foreign key is
  // NOT NULL, so "every district" is never a meaningful answer. Returning nothing
  // keeps the endpoint from dumping a whole branch's worth of rows by accident.
  if (spec.parent && !parentCode) return [];

  const where: Record<string, unknown> = {
    ...branchScope(spec, actor.branchId),
    status: "active",
  };
  if (spec.parent && parentCode) {
    where[spec.parent.model] = { code: parentCode };
  }

  const raw = await lookupDelegate(spec.model).findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { code: true, name: true, bnName: true },
  });

  return raw.map((r) => ({
    code: r.code as string,
    label: r.name as string,
    bnName: (r.bnName as string | null) ?? null,
  }));
}

export function listDivisions(actor: AuthUser) {
  return addressChildren(actor, ADDRESS_CATEGORY.divisions);
}

export function listDistricts(actor: AuthUser, divisionCode?: string) {
  return addressChildren(actor, ADDRESS_CATEGORY.districts, divisionCode);
}

/**
 * Localities under a district. The dataset has no thanas of its own, so this is
 * the upazila list and it also serves as the thana list.
 */
export async function listLocalities(actor: AuthUser, districtCode?: string) {
  const upazilas = await addressChildren(actor, ADDRESS_CATEGORY.upazilas, districtCode);
  return upazilas.map((u) => ({ ...u, type: "upazila" as const }));
}

/** Unions under an upazila. The deepest level in the dataset. */
export function listUnions(actor: AuthUser, upazilaCode?: string) {
  return addressChildren(actor, ADDRESS_CATEGORY.unions, upazilaCode);
}

/**
 * Rejects an address whose levels do not form a real chain, so a patient can
 * never end up with, say, a Savar upazila filed under a Chattogram district.
 * Returns the resolved chain so callers can store consistent values.
 */
export async function assertAddressChain(
  actor: AuthUser,
  input: {
    division?: string | null;
    district?: string | null;
    upazila?: string | null;
    thana?: string | null;
  },
): Promise<{
  division: string | null;
  district: string | null;
  upazila: string | null;
  thana: string | null;
}> {
  const { division, district, upazila, thana } = input;

  if (upazila && thana) {
    throw new ValidationError("Choose either an upazila or a thana, not both");
  }

  if ((upazila || thana) && !district) {
    throw new ValidationError("district is required when an upazila or thana is selected");
  }
  // A district without a division is not an error: the division is derived
  // from the district's parent link below.

  const resolve = async (
    value: string,
    category: string,
    parentCode: string | undefined,
    field: string,
    parentLabel?: string,
  ): Promise<{ code: string; label: string; parentCode: string | null }> => {
    const spec = lookupSpec(category);
    if (!spec.address) throw new ValidationError(`"${category}" is not an address level`);
    const where: Record<string, unknown> = {
      ...branchScope(spec, actor.branchId),
      status: "active",
      // Codes come from the cascading dropdowns, but records written before the
      // cascade existed hold plain labels ("Dhaka"), so both are accepted.
      OR: [{ code: value }, { name: value }],
    };
    // An undefined parent leaves the row unconstrained, which is what a district
    // needs when the division has not been chosen yet.
    if (parentCode !== undefined && spec.parent) {
      where[spec.parent.model] = { code: parentCode };
    }

    const raw = await lookupDelegate(spec.model).findFirst({
      where,
      select: { code: true, name: true, ...(spec.parent ? { [spec.parent.field]: true } : {}) },
    });
    if (!raw) {
      // A value that exists but under a different parent is the common mistake
      // here, so name the parent rather than reporting a bare "invalid value".
      throw new ValidationError(
        parentLabel
          ? `${field} "${value}" does not belong to ${parentLabel}`
          : `Invalid ${field}: ${value}`,
      );
    }
    const row = toLookupRow(spec, raw as never);
    return { code: row.code, label: row.name, parentCode: row.parentCode };
  };

  let divisionRow: { code: string; label: string } | null = null;
  let districtRow: { code: string; label: string; parentCode: string | null } | null = null;

  if (division) {
    divisionRow = await resolve(division, ADDRESS_CATEGORY.divisions, undefined, "division");
  }

  if (district) {
    if (divisionRow) {
      districtRow = await resolve(
        district,
        ADDRESS_CATEGORY.districts,
        divisionRow.code,
        "district",
        `division "${divisionRow.label}"`,
      );
    } else {
      // Records written before the cascade existed have a district but no
      // division. The district's parent link is enough to fill it in, so those
      // records stay editable instead of being rejected.
      districtRow = await resolve(district, ADDRESS_CATEGORY.districts, undefined, "district");
      if (districtRow.parentCode) {
        divisionRow = await resolve(
          districtRow.parentCode,
          ADDRESS_CATEGORY.divisions,
          undefined,
          "division",
        );
      }
    }
  }

  const locality = upazila || thana;
  let localityRow: { label: string } | null = null;
  if (locality && districtRow) {
    // A `thana` value can only come from a record written before the upazila
    // level took over as the thana, so both resolve against the upazila rows.
    localityRow = await resolve(
      locality,
      ADDRESS_CATEGORY.upazilas,
      districtRow.code,
      upazila ? "upazila" : "thana",
      `district "${districtRow.label}"`,
    );
  }

  // Labels are stored rather than codes so reports and printed records read
  // correctly without a join.
  return {
    division: divisionRow?.label ?? null,
    district: districtRow?.label ?? null,
    upazila: localityRow?.label ?? null,
    // Cleared on write: the locality now lives in `upazila`, and leaving a stale
    // thana would make the record disagree with itself.
    thana: null,
  };
}

/* ---------------------------------------------------------------------------
 * Writes
 * ------------------------------------------------------------------------- */

/**
 * Turns a `parentCode` from the API into the parent row's id, refusing a parent
 * that does not exist in this branch. The database would reject a dangling id
 * anyway, but a named error is far more useful than a foreign key violation.
 */
async function resolveParentId(
  actor: AuthUser,
  category: MasterDataCategory,
  parentCode: string | null | undefined,
): Promise<number | null> {
  const spec = LOOKUP_SPECS[category];
  if (!spec.parent) return null;
  if (!parentCode) return null;

  const parentSpec = LOOKUP_SPECS[spec.parent.category];
  const parent = await lookupDelegate(parentSpec.model).findFirst({
    where: {
      ...branchScope(parentSpec, actor.branchId),
      code: parentCode,
    },
    select: { id: true },
  });
  if (!parent) {
    throw new ValidationError(
      `${spec.parent.category}: no row with code "${parentCode}" in this branch`,
    );
  }
  return parent.id as number;
}

/** Columns a create/update may set, per category. `bnName`/`lat`/`lon`/`url` are
 * dataset-owned and never writable through the API. */
function writableData(
  spec: LookupSpec,
  branchId: number,
  input: { label?: string; code?: string | null; sortOrder?: number; status?: string },
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (spec.branchScoped) data.branchId = branchId;
  if (input.label !== undefined) data.name = input.label;
  if (input.code !== undefined) data.code = input.code;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.status !== undefined) data.status = input.status;
  return data;
}

export async function createMasterData(actor: AuthUser, input: CreateMasterDataInput) {
  const category = input.category as MasterDataCategory;
  assertAddressDataNotEditable(category);
  const spec = LOOKUP_SPECS[category];

  const parentId = await resolveParentId(actor, category, input.parentCode);
  if (spec.parent && parentId === null) {
    throw new ValidationError(
      `parentCode is required: a ${category.replace(/s$/, "")} must belong to a ${spec.parent.category.replace(/s$/, "")}`,
    );
  }

  try {
    const created = await lookupDelegate(spec.model).create({
      data: {
        ...writableData(spec, actor.branchId, input),
        ...(spec.parent ? { [spec.parent.field]: parentId } : {}),
      },
      select: lookupSelect(spec),
    });
    const row = toLookupRow(spec, created as never);

    await writeAuditLog({
      module: "masterData",
      action: "create",
      tableName: spec.model,
      recordId: String(row.id),
      newValues: {
        category,
        label: row.name,
        code: row.code,
        parentCode: row.parentCode,
        status: row.status,
      },
      user: actor,
      branchId: actor.branchId,
    });
    return toListItem(category, row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError(
        `"${input.label}" already exists in ${category}` +
          (input.parentCode ? ` under "${input.parentCode}"` : ""),
      );
    }
    throw err;
  }
}

export async function updateMasterData(
  actor: AuthUser,
  category: string,
  id: number,
  input: UpdateMasterDataInput,
) {
  // Rows live in eight tables, and each table numbers its own primary keys from 1,
  // so an id alone is ambiguous: deleting id 1 could hit a visit type, a division,
  // or a payment method. The category is part of the path so the row is addressed
  // unambiguously. `input.category` is a *move*, not the row's current table.
  if (!isMasterDataCategory(category)) {
    throw new ValidationError(`Unknown master data category "${category}"`);
  }
  const spec = LOOKUP_SPECS[category];

  const raw = await lookupDelegate(spec.model).findFirst({
    where: { id, ...branchScope(spec, actor.branchId) },
    select: lookupSelect(spec),
  });
  if (!raw) throw new NotFoundError("Master data item not found");
  const current = toLookupRow(spec, raw as never);

  assertAddressDataNotEditable(category);
  if (input.category) assertAddressDataNotEditable(input.category);

  const targetCategory = (input.category ?? category) as MasterDataCategory;
  const targetSpec = LOOKUP_SPECS[targetCategory];

  // Changing the category moves the row between two different tables. Doing it as a
  // delete plus create keeps each table's constraints honest (there is no
  // cross-table UPDATE) and is atomic from the caller's point of view.
  if (targetCategory !== category) {
    const moved = await createMasterData(actor, {
      category: targetCategory,
      label: input.label ?? current.name,
      code: input.code ?? current.code,
      parentCode: input.parentCode ?? current.parentCode,
      sortOrder: input.sortOrder ?? current.sortOrder,
      status: input.status ?? current.status,
    } as CreateMasterDataInput);
    await lookupDelegate(LOOKUP_SPECS[category].model).delete({ where: { id } });
    await writeAuditLog({
      module: "masterData",
      action: "update",
      tableName: `${LOOKUP_SPECS[category].model} -> ${targetSpec.model}`,
      recordId: String(id),
      oldValues: { category, label: current.name, code: current.code },
      newValues: { category: targetCategory, label: moved.label, code: moved.code },
      user: actor,
      branchId: actor.branchId,
    });
    return moved;
  }

  const data: Record<string, unknown> = writableData(spec, actor.branchId, {
    label: input.label,
    code: input.code,
    sortOrder: input.sortOrder,
    status: input.status,
  });

  if (input.parentCode !== undefined && spec.parent) {
    const parentId = await resolveParentId(actor, category, input.parentCode);
    if (parentId === null) {
      throw new ValidationError(
        `parentCode is required: a ${category.replace(/s$/, "")} must belong to a ${spec.parent.category.replace(/s$/, "")}`,
      );
    }
    data[spec.parent.field] = parentId;
  }

  try {
    const updated = await lookupDelegate(spec.model).update({
      where: { id },
      data,
      select: lookupSelect(spec),
    });
    const row = toLookupRow(spec, updated as never);

    await writeAuditLog({
      module: "masterData",
      action: "update",
      tableName: spec.model,
      recordId: String(id),
      oldValues: {
        category,
        label: current.name,
        code: current.code,
        parentCode: current.parentCode,
        status: current.status,
      },
      newValues: {
        label: row.name,
        code: row.code,
        parentCode: row.parentCode,
        status: row.status,
      },
      user: actor,
      branchId: actor.branchId,
    });
    return toListItem(category, row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError(
        `"${input.label ?? current.name}" already exists in ${category}` +
          (input.parentCode ? ` under "${input.parentCode}"` : ""),
      );
    }
    throw err;
  }
}

export async function deleteMasterData(actor: AuthUser, category: string, id: number) {
  // Same reason as update: an id is only unique within its table, so the category is
  // part of the path rather than guessed from the id.
  if (!isMasterDataCategory(category)) {
    throw new ValidationError(`Unknown master data category "${category}"`);
  }
  const spec = LOOKUP_SPECS[category];

  const raw = await lookupDelegate(spec.model).findFirst({
    where: { id, ...branchScope(spec, actor.branchId) },
    select: lookupSelect(spec),
  });
  if (!raw) throw new NotFoundError("Master data item not found");
  const current = toLookupRow(spec, raw as never);

  // This is the only guard a delete needs. The address hierarchy used to be guarded
  // by "does it still have children" and "does a patient name it", but both of those
  // only ever applied to address rows, and refusing the category outright covers
  // them: no address row can be removed, so nothing can be orphaned and no patient
  // can be stranded. The foreign keys on the app-owned lists are what stop a
  // district's parent from being deleted out from under it.
  assertAddressDataNotEditable(category);

  await lookupDelegate(spec.model).delete({ where: { id } });

  await writeAuditLog({
    module: "masterData",
    action: "delete",
    tableName: spec.model,
    recordId: String(id),
    oldValues: {
      category,
      label: current.name,
      code: current.code,
      parentCode: current.parentCode,
    },
    user: actor,
    branchId: actor.branchId,
  });
}

/* ---------------------------------------------------------------------------
 * Localization
 * ------------------------------------------------------------------------- */

const DEFAULT_CURRENCY = "BDT";
const DEFAULT_CURRENCY_SYMBOL = "৳";

/**
 * The Localization currency is THE hospital-wide display currency (Settings →
 * Localization → Currency). Every branch shares one value: reads reuse whichever
 * existing row is present (all rows are kept in sync), and any currency change is
 * propagated to every branch/language row. This is NOT an exchange-rate conversion;
 * stored amounts are never modified.
 */
async function getCentralCurrencyDefaults() {
  const any = await prisma.localizationSetting.findFirst({ orderBy: { id: "asc" } });
  return {
    currency: any?.currency ?? DEFAULT_CURRENCY,
    currencySymbol: any?.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL,
  };
}

export async function getLocalizationSetting(actor: AuthUser) {
  const existing = await prisma.localizationSetting.findFirst({
    where: { branchId: actor.branchId, language: "English" },
  });
  if (existing) return existing;

  const central = await getCentralCurrencyDefaults();
  return prisma.localizationSetting.create({
    data: {
      branchId: actor.branchId,
      language: "English",
      currency: central.currency,
      currencySymbol: central.currencySymbol,
      dateFormat: "DD-MM-YYYY",
      timeFormat: "24h",
      timezone: "Asia/Dhaka",
      numberFormat: "en-US",
      weekStartDay: 1,
    },
  });
}

export async function updateLocalizationSetting(
  actor: AuthUser,
  input: UpdateLocalizationSettingInput,
) {
  const current = await getLocalizationSetting(actor);

  const updated = await prisma.localizationSetting.update({
    where: { id: current.id },
    data: { ...input },
  });

  // Currency is CENTRAL: a change to currency/currencySymbol is applied to every
  // branch (and every language) row so no branch can override the shared value.
  if (input.currency !== undefined || input.currencySymbol !== undefined) {
    await prisma.localizationSetting.updateMany({
      where: {},
      data: {
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.currencySymbol !== undefined ? { currencySymbol: input.currencySymbol } : {}),
      },
    });
  }

  await writeAuditLog({
    module: "localizationSetting",
    action: "update",
    tableName: "LocalizationSetting",
    recordId: String(updated.id),
    oldValues: {
      language: current.language,
      currency: current.currency,
      currencySymbol: current.currencySymbol,
      dateFormat: current.dateFormat,
      timeFormat: current.timeFormat,
      timezone: current.timezone,
    },
    newValues: {
      ...(input.language ? { language: input.language } : {}),
      ...(input.currency ? { currency: input.currency } : {}),
      ...(input.currencySymbol ? { currencySymbol: input.currencySymbol } : {}),
      ...(input.dateFormat ? { dateFormat: input.dateFormat } : {}),
      ...(input.timeFormat ? { timeFormat: input.timeFormat } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
    },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

/* ---------------------------------------------------------------------------
 * System Maintenance
 * ------------------------------------------------------------------------- */

async function dbHealthCheck(): Promise<string> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "Optimal";
  } catch {
    return "Degraded";
  }
}

export async function getSystemMaintenance(actor: AuthUser) {
  const first = await prisma.systemMaintenance.findFirst();
  let row = first;
  if (!row) {
    row = await prisma.systemMaintenance.create({
      data: {
        maintenanceMode: false,
        cacheEnabled: true,
        systemVersion: "2.1.0",
        status: "active",
      },
    });
  }

  const dbHealth = await dbHealthCheck();
  return {
    ...row,
    uptimeSeconds: process.uptime(),
    dbHealth,
  };
}

export async function updateSystemMaintenance(
  actor: AuthUser,
  input: UpdateSystemMaintenanceInput,
) {
  const first = await prisma.systemMaintenance.findFirst();
  let current = first;
  if (!current) {
    current = await prisma.systemMaintenance.create({
      data: {
        maintenanceMode: false,
        cacheEnabled: true,
        systemVersion: "2.1.0",
        status: "active",
      },
    });
  }

  const updated = await prisma.systemMaintenance.update({
    where: { id: current.id },
    data: { ...input },
  });

  await writeAuditLog({
    module: "systemMaintenance",
    action: "update",
    tableName: "SystemMaintenance",
    recordId: String(updated.id),
    oldValues: {
      maintenanceMode: current.maintenanceMode,
      cacheEnabled: current.cacheEnabled,
      systemVersion: current.systemVersion,
      status: current.status,
    },
    newValues: {
      ...(input.maintenanceMode !== undefined ? { maintenanceMode: input.maintenanceMode } : {}),
      ...(input.cacheEnabled !== undefined ? { cacheEnabled: input.cacheEnabled } : {}),
      ...(input.systemVersion !== undefined ? { systemVersion: input.systemVersion } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

export async function clearSystemCache(actor: AuthUser) {
  const now = new Date();
  const first = await prisma.systemMaintenance.findFirst();
  if (!first) {
    throw new NotFoundError("System maintenance record not found");
  }
  const updated = await prisma.systemMaintenance.update({
    where: { id: first.id },
    data: { lastCacheClear: now },
  });

  await writeAuditLog({
    module: "systemMaintenance",
    action: "cache-clear",
    tableName: "SystemMaintenance",
    recordId: String(updated.id),
    oldValues: { lastCacheClear: first.lastCacheClear },
    newValues: { lastCacheClear: now },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}

export async function optimizeDatabase(actor: AuthUser) {
  const now = new Date();
  const first = await prisma.systemMaintenance.findFirst();
  if (!first) {
    throw new NotFoundError("System maintenance record not found");
  }
  const updated = await prisma.systemMaintenance.update({
    where: { id: first.id },
    data: { databaseOptimization: now },
  });

  await writeAuditLog({
    module: "systemMaintenance",
    action: "optimize",
    tableName: "SystemMaintenance",
    recordId: String(updated.id),
    oldValues: { databaseOptimization: first.databaseOptimization },
    newValues: { databaseOptimization: now },
    user: actor,
    branchId: actor.branchId,
  });
  return updated;
}
