import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { assertAddressChain } from "../settings/setting.service";
import { CODE_ENTITIES, generateBusinessCode } from "../../utils/codeGenerator";
import { parsePagination, buildPaginationMeta, type SortableField } from "../../utils/pagination";
import type { AuthUser } from "../../types/auth";
import type {
  CreateContactInput,
  CreatePatientInput,
  ListPatientsQuery,
  UpdateContactInput,
  UpdatePatientInput,
  UpdatePatientStatusInput,
} from "./patient.validation";
import {
  DEFAULT_PATIENT_SETTINGS,
  DUPLICATE_LABELS,
  GUARDIAN_REQUIREMENT_VALUES,
  PATIENT_TYPE_VALUES,
  isMinor,
  normalizeIdPrefix,
  type DuplicateMatch,
  type GuardianRequirement,
  type PatientType,
} from "./patient.policy";
import { findDuplicatePatients } from "./patientDuplicate";

/* ---------------------------------------------------------------------------
 * Branch isolation helpers (mirror the users module)
 * ------------------------------------------------------------------------- */
function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

function enforceBranchAccess(actor: AuthUser, targetBranchId: number): void {
  if (!isSuperAdmin(actor) && actor.branchId !== targetBranchId) {
    throw new AuthorizationError("You do not have permission to access this branch");
  }
}

/* ---------------------------------------------------------------------------
 * Select shapes
 * ------------------------------------------------------------------------- */
const PATIENT_LIST_SELECT: Prisma.PatientSelect = {
  id: true,
  patientCode: true,
  name: true,
  patientType: true,
  gender: true,
  dateOfBirth: true,
  bloodGroup: true,
  phone: true,
  email: true,
  whatsapp: true,
  address: true,
  district: true,
  division: true,
  upazila: true,
  thana: true,
  maritalStatus: true,
  status: true,
  branchId: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true, code: true } },
  contacts: {
    select: { id: true, name: true, relationship: true, phone: true, isPrimary: true },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
  },
};

const PATIENT_DETAIL_SELECT: Prisma.PatientSelect = {
  ...PATIENT_LIST_SELECT,
  nationalId: true,
  occupation: true,
  photo: true,
  deletedAt: true,
  createdById: true,
  updatedById: true,
  _count: {
    select: {
      appointments: true,
      admissions: true,
      medicalRecords: true,
      prescriptions: true,
      labOrders: true,
      invoices: true,
      payments: true,
    },
  },
};

const SCALAR_FIELD_SELECT: Prisma.PatientSelect = {
  name: true,
  patientType: true,
  gender: true,
  dateOfBirth: true,
  bloodGroup: true,
  maritalStatus: true,
  phone: true,
  email: true,
  whatsapp: true,
  address: true,
  district: true,
  division: true,
  upazila: true,
  thana: true,
  nationalId: true,
  occupation: true,
  photo: true,
};

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/**
 * Patient Configuration for a branch.
 *
 * A branch with no row yet behaves as "no configuration": the required-contact
 * toggles are all satisfied and the remaining switches fall back to their
 * built-in defaults, so a fresh branch can register patients before anyone
 * visits the Patient Configuration screen.
 */
export type EffectivePatientConfig = {
  exists: boolean;
  patientIdPrefix: string;
  autoGenerateId: boolean;
  defaultPatientType: PatientType;
  requireGuardian: GuardianRequirement;
  duplicateDetection: boolean;
  phoneRequired: boolean;
  emailRequired: boolean;
  whatsappRequired: boolean;
};

async function loadPatientConfig(branchId: number): Promise<EffectivePatientConfig> {
  const setting = await prisma.patientSetting.findFirst({
    where: { branchId },
    orderBy: { id: "asc" },
    select: {
      patientIdPrefix: true,
      autoGenerateId: true,
      defaultPatientType: true,
      requireGuardian: true,
      duplicateDetection: true,
      phoneRequired: true,
      emailRequired: true,
      whatsappRequired: true,
    },
  });

  if (!setting) {
    return {
      exists: false,
      ...DEFAULT_PATIENT_SETTINGS,
      defaultPatientType: DEFAULT_PATIENT_SETTINGS.defaultPatientType as PatientType,
      requireGuardian: DEFAULT_PATIENT_SETTINGS.requireGuardian as GuardianRequirement,
    };
  }

  return {
    exists: true,
    // Every field falls back individually: a row written by an older schema (or
    // hand-edited) must degrade to the default instead of to "undefined", which
    // would silently disable auto-generation.
    patientIdPrefix: setting.patientIdPrefix ?? DEFAULT_PATIENT_SETTINGS.patientIdPrefix,
    autoGenerateId: setting.autoGenerateId ?? DEFAULT_PATIENT_SETTINGS.autoGenerateId,
    // The columns are free-form strings, so a value written before the enum
    // existed is coerced rather than allowed to poison a new patient.
    defaultPatientType: asPatientType(setting.defaultPatientType),
    requireGuardian: asGuardianRequirement(setting.requireGuardian),
    duplicateDetection:
      setting.duplicateDetection ?? DEFAULT_PATIENT_SETTINGS.duplicateDetection,
    phoneRequired: setting.phoneRequired ?? DEFAULT_PATIENT_SETTINGS.phoneRequired,
    emailRequired: setting.emailRequired ?? DEFAULT_PATIENT_SETTINGS.emailRequired,
    whatsappRequired: setting.whatsappRequired ?? DEFAULT_PATIENT_SETTINGS.whatsappRequired,
  };
}

function asPatientType(value: string): PatientType {
  return (PATIENT_TYPE_VALUES as readonly string[]).includes(value)
    ? (value as PatientType)
    : "NEW";
}

function asGuardianRequirement(value: string): GuardianRequirement {
  return (GUARDIAN_REQUIREMENT_VALUES as readonly string[]).includes(value)
    ? (value as GuardianRequirement)
    : "MINORS_ONLY";
}

/**
 * The registration settings the create form needs to render itself.
 *
 * The Patient Configuration screen itself is gated on `patientSetting:read`,
 * which a doctor or receptionist creating a patient does not hold — so the form
 * cannot read it there. Only the handful of fields that change how the form
 * behaves are exposed; the required-contact toggles are deliberately left out
 * because the server enforces them and reports them as field errors anyway.
 */
export async function getPatientRegistrationConfig(
  actor: AuthUser,
  requestedBranchId?: number,
): Promise<{
  autoGenerateId: boolean;
  patientIdPrefix: string;
  defaultPatientType: PatientType;
  requireGuardian: GuardianRequirement;
  duplicateDetection: boolean;
}> {
  // Mirrors createPatient: ordinary users are pinned to their own branch, a
  // super admin may ask about another one.
  const branchId = isSuperAdmin(actor) && requestedBranchId ? requestedBranchId : actor.branchId;
  const config = await loadPatientConfig(branchId);
  return {
    autoGenerateId: config.autoGenerateId,
    patientIdPrefix: config.patientIdPrefix,
    defaultPatientType: config.defaultPatientType,
    requireGuardian: config.requireGuardian,
    duplicateDetection: config.duplicateDetection,
  };
}

/**
 * Honors the branch's PatientSetting "required contact" toggles. The setting
 * decides which contact channels must be present, so the values submitted for
 * this branch are validated here (after the merge on update, so clearing a
 * previously stored value is rejected too).
 */
async function assertRequiredContactChannels(
  config: EffectivePatientConfig,
  values: { phone?: string | null; email?: string | null; whatsapp?: string | null },
): Promise<void> {
  // Each rejection names its field via `details` so the registration form can
  // mark the offending input rather than showing a bare banner.
  if (config.whatsappRequired && !values.whatsapp?.trim()) {
    const message = "WhatsApp number is required by this branch's patient configuration";
    throw new BusinessRuleError(message, { whatsapp: message });
  }
  if (config.phoneRequired && !values.phone?.trim()) {
    const message = "Phone number is required by this branch's patient configuration";
    throw new BusinessRuleError(message, { phone: message });
  }
  if (config.emailRequired && !values.email?.trim()) {
    const message = "Email is required by this branch's patient configuration";
    throw new BusinessRuleError(message, { email: message });
  }
}

/**
 * Enforces PatientSetting.requireGuardian.
 *
 *   NEVER       no guardian/emergency contact needed
 *   MINORS_ONLY needed only when the patient is under 18
 *   ALWAYS      needed for every registration
 *
 * A patient without a date of birth cannot be classified, so MINORS_ONLY lets
 * the registration through (refusing it would make the date of birth mandatory
 * for the whole hospital, which is a different policy than this setting).
 *
 * The contact must be reachable, so a row with a name but no phone does not
 * satisfy the requirement.
 */
function assertGuardianRequirement(
  config: EffectivePatientConfig,
  patient: { dateOfBirth?: Date | null },
  contacts: Array<{ name?: string | null; phone?: string | null }> | undefined,
): void {
  if (config.requireGuardian === "NEVER") return;

  if (config.requireGuardian === "MINORS_ONLY" && !isMinor(patient.dateOfBirth)) {
    return;
  }

  const reachable = (contacts ?? []).some((c) => c.phone?.trim());
  if (reachable) return;

  const reason =
    config.requireGuardian === "MINORS_ONLY"
      ? "patients under 18"
      : "every patient";
  const message =
    `This branch requires an emergency contact with a phone number for ${reason}. ` +
    "Add one to the Emergency Contacts section.";
  throw new BusinessRuleError(message, { contacts: message });
}

/**
 * Applies PatientSetting.duplicateDetection.
 *
 * Strong matches (national ID / phone / email) refuse the registration. Soft
 * matches (name + date of birth) are reported back so the caller can surface a
 * warning, and are only allowed to proceed when the user acknowledged them with
 * `overrideDuplicate`.
 */
async function assertNotDuplicate(
  config: EffectivePatientConfig,
  candidate: {
    branchId: number;
    excludePatientId?: number;
    name: string;
    dateOfBirth?: Date | null;
    phone?: string | null;
    email?: string | null;
    nationalId?: string | null;
  },
  override: boolean,
): Promise<DuplicateMatch[]> {
  if (!config.duplicateDetection) return [];

  const { blocking, advisory } = await findDuplicatePatients(candidate);

  if (blocking.length > 0) {
    const byField = new Map<string, DuplicateMatch[]>();
    for (const match of blocking) {
      byField.set(match.field, [...(byField.get(match.field) ?? []), match]);
    }
    const summary = [...byField.entries()]
      .map(([field, matches]) => {
        const codes = matches.map((m) => m.patientCode).join(", ");
        return `${DUPLICATE_LABELS[field as keyof typeof DUPLICATE_LABELS]} already registered as ${codes}`;
      })
      .join("; ");

    const message =
      `A patient with this ${summary}. ` +
      "Open the existing record, or correct the details you entered.";

    // Name the offending inputs so the form can highlight them.
    const details: Record<string, string> = {};
    for (const [field] of byField) {
      if (field in candidate) details[field] = message;
    }

    throw new ConflictError(message, { matches: blocking, fields: details });
  }

  if (advisory.length > 0 && !override) {
    throw new ConflictError(
      `A patient with the same name and date of birth already exists (${advisory
        .map((m) => m.patientCode)
        .join(", ")}). Confirm this is a different person to continue.`,
      { matches: advisory, requiresAcknowledgement: true },
    );
  }

  return advisory;
}

type AddressInput = {
  division?: string | null;
  district?: string | null;
  upazila?: string | null;
  thana?: string | null;
};

/**
 * Runs the submitted address levels through Master Data so only a real
 * division -> district -> (upazila | thana) chain is stored, and the stored
 * values are labels rather than the dropdown codes.
 *
 * On update the levels are merged with what is already on the record, so
 * changing only the district still validates the upazila that is kept.
 */
async function resolveAddressChain(
  actor: AuthUser,
  input: AddressInput,
  current?: { division: string | null; district: string | null; upazila: string | null; thana: string | null },
) {
  const pick = (field: keyof AddressInput) => {
    const submitted = input[field];
    if (submitted === undefined) return current ? current[field] : undefined;
    // An empty string means "cleared", not "keep the old value".
    return submitted?.trim() ? submitted : null;
  };

  const merged: AddressInput = {
    division: pick("division"),
    district: pick("district"),
    upazila: pick("upazila"),
    thana: pick("thana"),
  };

  const touched = (Object.keys(merged) as Array<keyof AddressInput>).some(
    (field) => input[field] !== undefined,
  );

  // Nothing about the address is being changed, so leave the record alone.
  if (!touched && !current) {
    return { division: null, district: null, upazila: null, thana: null };
  }
  if (!touched && current) {
    return {
      division: current.division,
      district: current.district,
      upazila: current.upazila,
      thana: current.thana,
    };
  }

  return assertAddressChain(actor, merged);
}

/** Fetches a non-deleted patient and enforces branch authorization. */
async function getActivePatientForActor(
  actor: AuthUser,
  id: number,
): Promise<{ id: number; branchId: number; patientCode: string }> {
  const patient = await prisma.patient.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, branchId: true, patientCode: true },
  });
  if (!patient) {
    throw new NotFoundError("Patient not found");
  }
  enforceBranchAccess(actor, patient.branchId);
  return patient;
}

function buildListWhere(actor: AuthUser, query: ListPatientsQuery): Prisma.PatientWhereInput {
  const where: Prisma.PatientWhereInput = {
    deletedAt: null,
  };

  // Branch scoping: normal users only their branch, SUPER_ADMIN may filter.
  if (isSuperAdmin(actor)) {
    if (query.branchId) where.branchId = query.branchId;
  } else {
    where.branchId = actor.branchId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.gender) {
    where.gender = query.gender;
  }

  if (query.patientCode) {
    where.patientCode = { contains: query.patientCode };
  }

  // A single free-text search across several fields. MySQL uses a
  // case-insensitive collation, so plain `contains` is sufficient.
  const search = query.search?.trim();
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { patientCode: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
      { whatsapp: { contains: search } },
    ];
  }

  // Targeted filters
  const exactFilters: Prisma.PatientWhereInput[] = [];
  if (query.name) {
    exactFilters.push({ name: { contains: query.name } });
  }
  if (query.phone) {
    exactFilters.push({ phone: { contains: query.phone } });
  }
  if (query.email) {
    exactFilters.push({ email: { contains: query.email } });
  }
  if (query.whatsapp) {
    exactFilters.push({ whatsapp: { contains: query.whatsapp } });
  }

  if (exactFilters.length > 0) {
    where.AND = exactFilters;
  }

  return where;
}

/* ---------------------------------------------------------------------------
 * Patient CRUD
 * ------------------------------------------------------------------------- */

export type CreatedPatient = {
  id: number;
  branchId: number;
  patientCode: string;
  patientType: PatientType;
  /** Advisory duplicate matches the user acknowledged with overrideDuplicate. */
  duplicateWarnings: DuplicateMatch[];
};

export async function createPatient(
  actor: AuthUser,
  input: CreatePatientInput,
): Promise<CreatedPatient> {
  // Normal users are always bound to their own branch; SUPER_ADMIN may choose.
  let targetBranchId: number;
  if (isSuperAdmin(actor)) {
    targetBranchId = input.branchId ?? actor.branchId;
    if (input.branchId && input.branchId !== actor.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true } });
      if (!branch) {
        throw new NotFoundError("Branch not found");
      }
    }
  } else {
    if (input.branchId && input.branchId !== actor.branchId) {
      throw new AuthorizationError("You do not have permission to create a patient in another branch");
    }
    targetBranchId = actor.branchId;
  }

  // One read of the branch's configuration drives every rule below.
  const config = await loadPatientConfig(targetBranchId);

  // PatientSetting.autoGenerateId decides who assigns the identifier. Checked
  // first: it is a pure input-shape rule, so a mistyped ID is reported before
  // any contact, guardian or duplicate work is done.
  if (config.autoGenerateId && input.patientCode) {
    const message =
      "Patient IDs are generated automatically for this branch. Remove the patient ID you entered.";
    throw new BusinessRuleError(message, { patientCode: message });
  }
  if (!config.autoGenerateId && !input.patientCode) {
    const message =
      "This branch does not generate patient IDs automatically. Enter a patient ID.";
    throw new BusinessRuleError(message, { patientCode: message });
  }

  await assertRequiredContactChannels(config, {
    phone: input.phone,
    email: input.email,
    whatsapp: input.whatsapp,
  });

  assertGuardianRequirement(config, { dateOfBirth: input.dateOfBirth }, input.contacts);

  const duplicateWarnings = await assertNotDuplicate(
    config,
    {
      branchId: targetBranchId,
      name: input.name,
      dateOfBirth: input.dateOfBirth,
      phone: input.phone,
      email: input.email,
      nationalId: input.nationalId,
    },
    input.overrideDuplicate === true,
  );

  // defaultPatientType applies unless the caller chose explicitly.
  const patientType = input.patientType ?? config.defaultPatientType;

  // Resolves the cascade to labels and rejects a broken chain (an upazila that
  // does not belong to the chosen district, both a thana and an upazila, ...).
  const addressChain = await resolveAddressChain(actor, input);

  const data: Omit<Prisma.PatientCreateInput, "patientCode"> = {
    branch: { connect: { id: targetBranchId } },
    name: input.name,
    patientType,
    gender: input.gender,
    dateOfBirth: input.dateOfBirth,
    bloodGroup: input.bloodGroup,
    maritalStatus: input.maritalStatus,
    phone: input.phone,
    email: input.email,
    whatsapp: input.whatsapp,
    address: input.address,
    district: addressChain.district,
    division: addressChain.division,
    upazila: addressChain.upazila,
    thana: addressChain.thana,
    nationalId: input.nationalId,
    occupation: input.occupation,
    photo: input.photo,
    status: "active",
    createdById: actor.id,
    updatedById: actor.id,
  };

  if (input.contacts && input.contacts.length > 0) {
    data.contacts = { create: input.contacts.map((c) => ({ ...c })) };
  }

  let patient: { id: number; branchId: number; patientCode: string; patientType: string };
  try {
    // Claim the next branch-scoped patient code and create the record in one
    // transaction: if creation fails the sequence increment rolls back too.
    patient = await prisma.$transaction(async (tx) => {
      const patientCode = config.autoGenerateId
        ? await generateBusinessCode(tx, CODE_ENTITIES.PATIENT, targetBranchId, {
            prefix: config.patientIdPrefix,
          })
        : (input.patientCode as string);
      return tx.patient.create({
        data: { ...data, patientCode },
        select: { id: true, branchId: true, patientCode: true, patientType: true },
      });
    });
  } catch (err) {
    // Final safety net: the unique [branchId, patientCode] index. It is the
    // normal failure mode for a manually entered patient ID.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const message = config.autoGenerateId
        ? "Patient code already exists in this branch"
        : `Patient ID ${input.patientCode} is already used in this branch`;
      // A manual code collision is a form input problem, so it names the field.
      throw new ConflictError(
        message,
        config.autoGenerateId ? undefined : { patientCode: message },
      );
    }
    throw err;
  }

  await writeAuditLog({
    module: "PATIENT",
    action: "PATIENT_CREATED",
    tableName: "Patient",
    recordId: String(patient.id),
    newValues: {
      patientCode: patient.patientCode,
      name: input.name,
      patientType,
      branchId: targetBranchId,
      contactCount: input.contacts?.length ?? 0,
      ...(config.autoGenerateId
        ? {}
        : { patientCodeSource: "manual", patientIdPrefix: normalizeIdPrefix(config.patientIdPrefix) }),
      ...(duplicateWarnings.length > 0
        ? { duplicateWarningCodes: duplicateWarnings.map((m) => m.patientCode).join(", ") }
        : {}),
    },
    user: actor,
    branchId: targetBranchId,
  });

  return {
    id: patient.id,
    branchId: patient.branchId,
    patientCode: patient.patientCode,
    patientType,
    duplicateWarnings,
  };
}

export async function listPatients(actor: AuthUser, query: ListPatientsQuery) {
  const { page, limit, search, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);
  const where = buildListWhere(actor, { ...query, ...(search ? { search } : {}) });

  const [total, patients] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      select: PATIENT_LIST_SELECT,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy as SortableField]: sortOrder },
    }),
  ]);

  return {
    data: patients,
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export async function getPatient(actor: AuthUser, id: number) {
  const patient = await prisma.patient.findFirst({
    where: { id, deletedAt: null },
    select: PATIENT_DETAIL_SELECT,
  });
  if (!patient) {
    throw new NotFoundError("Patient not found");
  }
  enforceBranchAccess(actor, patient.branchId);
  return patient;
}

export async function updatePatient(actor: AuthUser, id: number, input: UpdatePatientInput) {
  const existing = await getActivePatientForActor(actor, id);

  const data: Prisma.PatientUpdateInput = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  // Literal keys so the same list type-checks against both the update input and
  // the scalar select (UpdatePatientInput also carries non-column flags such as
  // overrideDuplicate, which must never be read from the row).
  const scalarFields = [
    "name",
    "patientType",
    "gender",
    "dateOfBirth",
    "bloodGroup",
    "maritalStatus",
    "phone",
    "email",
    "whatsapp",
    "address",
    "nationalId",
    "occupation",
    "photo",
  ] as const satisfies readonly (keyof UpdatePatientInput)[];

  // The cascade levels are handled separately: they must be validated together
  // and written as labels, not as the raw dropdown codes.
  const ADDRESS_FIELDS = ["division", "district", "upazila", "thana"] as const;
  const addressTouched = ADDRESS_FIELDS.some((f) => input[f] !== undefined);
  if (addressTouched) {
    const current = await prisma.patient.findUnique({
      where: { id },
      select: { division: true, district: true, upazila: true, thana: true },
    });
    const chain = await resolveAddressChain(actor, input, {
      division: current?.division ?? null,
      district: current?.district ?? null,
      upazila: current?.upazila ?? null,
      thana: current?.thana ?? null,
    });
    for (const field of ADDRESS_FIELDS) {
      const submitted = input[field];
      if (submitted === undefined) continue;
      const resolved = chain[field];
      if (resolved !== (current?.[field] ?? null)) {
        (data as Record<string, unknown>)[field] = resolved;
        newValues[field] = resolved;
      }
    }
  }

  for (const field of scalarFields) {
    if (input[field] !== undefined) {
      (data as Record<string, unknown>)[field] = input[field];
      newValues[field] = input[field];
    }
  }

  // Only meaningful changes are persisted and audited.
  if (Object.keys(data).length > 0) {
    const full = await prisma.patient.findUnique({ where: { id }, select: SCALAR_FIELD_SELECT });
    if (full) {
      for (const field of scalarFields) {
        const wasDefined = input[field] !== undefined;
        if (wasDefined) {
          const oldVal = full[field];
          oldValues[field] = oldVal instanceof Date ? oldVal.toISOString() : oldVal;
        }
      }

      const config = await loadPatientConfig(existing.branchId);

      // Validate the post-update state so a required channel cannot be
      // cleared by an update that omits it or blanks it out.
      await assertRequiredContactChannels(config, {
        phone: input.phone !== undefined ? input.phone : full.phone,
        email: input.email !== undefined ? input.email : full.email,
        whatsapp: input.whatsapp !== undefined ? input.whatsapp : full.whatsapp,
      });

      // Duplicate detection runs on the merged state so an update cannot
      // introduce a collision that a creation would have refused. The record
      // itself is excluded so re-saving a patient does not match itself.
      const mergedIdentityFields = ["phone", "email", "nationalId", "name", "dateOfBirth"] as const;
      if (mergedIdentityFields.some((f) => input[f] !== undefined)) {
        await assertNotDuplicate(
          config,
          {
            branchId: existing.branchId,
            excludePatientId: id,
            name: input.name !== undefined ? input.name : full.name,
            dateOfBirth: input.dateOfBirth !== undefined ? input.dateOfBirth : full.dateOfBirth,
            phone: input.phone !== undefined ? input.phone : full.phone,
            email: input.email !== undefined ? input.email : full.email,
            nationalId: input.nationalId !== undefined ? input.nationalId : full.nationalId,
          },
          input.overrideDuplicate === true,
        );
      }

      // A date of birth that makes the patient a minor re-triggers the guardian
      // requirement, using the contacts already on the record.
      if (config.requireGuardian !== "NEVER" && input.dateOfBirth !== undefined) {
        const contacts = await prisma.patientContact.findMany({
          where: { patientId: id },
          select: { name: true, phone: true },
        });
        assertGuardianRequirement(config, { dateOfBirth: input.dateOfBirth }, contacts);
      }
    }

    data.updatedById = actor.id;
    await prisma.patient.update({ where: { id }, data });

    await writeAuditLog({
      module: "PATIENT",
      action: "PATIENT_UPDATED",
      tableName: "Patient",
      recordId: String(id),
      oldValues,
      newValues,
      user: actor,
      branchId: existing.branchId,
    });
  }

  return getPatient(actor, id);
}

export async function updatePatientStatus(actor: AuthUser, id: number, input: UpdatePatientStatusInput) {
  const existing = await getActivePatientForActor(actor, id);

  const patient = await prisma.patient.update({
    where: { id },
    data: { status: input.status, updatedById: actor.id },
    select: { id: true, status: true },
  });

  await writeAuditLog({
    module: "PATIENT",
    action: "PATIENT_STATUS_CHANGED",
    tableName: "Patient",
    recordId: String(id),
    oldValues: {},
    newValues: { status: patient.status },
    user: actor,
    branchId: existing.branchId,
  });

  return patient;
}

/**
 * Soft deletes a patient. Physically preserving medical and financial history is
 * guaranteed by the FK ON DELETE RESTRICT rules — but we refuse to soft-delete a
 * patient that still has open clinical or financial activity so that downstream
 * workflows are not invalidated.
 */
export async function deletePatient(actor: AuthUser, id: number): Promise<void> {
  const existing = await getActivePatientForActor(actor, id);

  const openActivity = await prisma.patient.findFirst({
    where: {
      id,
      OR: [
        { appointments: { some: { deletedAt: null, status: { in: ["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION"] } } } },
        { admissions: { some: { deletedAt: null, status: { in: ["ADMITTED", "TRANSFERRED"] } } } },
        { invoices: { some: { status: { in: ["DRAFT", "PENDING", "PARTIAL"] } } } },
      ],
    },
    select: { id: true },
  });

  if (openActivity) {
    throw new BusinessRuleError(
      "Patient has open appointments, admissions or unsettled invoices and cannot be deleted until those are resolved",
    );
  }

  await prisma.patient.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: actor.id },
  });

  await writeAuditLog({
    module: "PATIENT",
    action: "PATIENT_DELETED",
    tableName: "Patient",
    recordId: String(id),
    oldValues: { deletedAt: null },
    newValues: { deletedAt: new Date().toISOString() },
    user: actor,
    branchId: existing.branchId,
  });
}

/* ---------------------------------------------------------------------------
 * Contacts (always through the owning patient's authorization)
 * ------------------------------------------------------------------------- */

export async function listContacts(actor: AuthUser, patientId: number) {
  await getActivePatientForActor(actor, patientId);
  return prisma.patientContact.findMany({
    where: { patientId },
    select: { id: true, name: true, relationship: true, phone: true, address: true, isPrimary: true },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
  });
}

export async function createContact(actor: AuthUser, patientId: number, input: CreateContactInput) {
  const patient = await getActivePatientForActor(actor, patientId);

  let contactId: number;
  await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.patientContact.updateMany({
        where: { patientId },
        data: { isPrimary: false },
      });
    }
    const created = await tx.patientContact.create({
      data: { patientId, ...input },
      select: { id: true },
    });
    contactId = created.id;
  });

  await writeAuditLog({
    module: "PATIENT",
    action: "PATIENT_CONTACT_CREATED",
    tableName: "PatientContact",
    recordId: String(contactId!),
    newValues: input as unknown as Record<string, unknown>,
    user: actor,
    branchId: patient.branchId,
  });

  return prisma.patientContact.findUniqueOrThrow({
    where: { id: contactId! },
    select: { id: true, name: true, relationship: true, phone: true, address: true, isPrimary: true },
  });
}

async function getOwnedContact(actor: AuthUser, patientId: number, contactId: number) {
  const patient = await getActivePatientForActor(actor, patientId);
  const contact = await prisma.patientContact.findFirst({
    where: { id: contactId, patientId },
    select: { id: true, name: true, relationship: true, phone: true, address: true, isPrimary: true },
  });
  if (!contact) {
    throw new NotFoundError("Contact not found");
  }
  return { patient, contact };
}

export async function updateContact(
  actor: AuthUser,
  patientId: number,
  contactId: number,
  input: UpdateContactInput,
) {
  const { patient } = await getOwnedContact(actor, patientId, contactId);

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.patientContact.updateMany({
        where: { patientId, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }
    return tx.patientContact.update({
      where: { id: contactId },
      data: input,
      select: { id: true, name: true, relationship: true, phone: true, address: true, isPrimary: true },
    });
  });

  await writeAuditLog({
    module: "PATIENT",
    action: "PATIENT_CONTACT_UPDATED",
    tableName: "PatientContact",
    recordId: String(contactId),
    newValues: input as unknown as Record<string, unknown>,
    user: actor,
    branchId: patient.branchId,
  });

  return updated;
}

export async function deleteContact(actor: AuthUser, patientId: number, contactId: number): Promise<void> {
  const { patient } = await getOwnedContact(actor, patientId, contactId);

  await prisma.patientContact.delete({ where: { id: contactId } });

  await writeAuditLog({
    module: "PATIENT",
    action: "PATIENT_CONTACT_DELETED",
    tableName: "PatientContact",
    recordId: String(contactId),
    user: actor,
    branchId: patient.branchId,
  });
}