import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import type { AuthUser } from "../../types/auth";
import type {
  ListSystemSettingsQuery,
  UpdatePatientSettingInput,
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