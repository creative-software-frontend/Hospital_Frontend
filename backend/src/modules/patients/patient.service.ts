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
 * Honors the branch's PatientSetting "required contact" toggles. The setting
 * decides which contact channels must be present, so the values submitted for
 * this branch are validated here (after the merge on update, so clearing a
 * previously stored value is rejected too).
 */
async function assertRequiredContactChannels(
  branchId: number,
  values: { phone?: string | null; email?: string | null; whatsapp?: string | null },
): Promise<void> {
  const setting = await prisma.patientSetting.findFirst({
    where: { branchId },
    orderBy: { id: "asc" },
    select: { phoneRequired: true, emailRequired: true, whatsappRequired: true },
  });
  if (!setting) return;

  if (setting.whatsappRequired && !values.whatsapp?.trim()) {
    throw new BusinessRuleError("WhatsApp number is required by this branch's patient configuration");
  }
  if (setting.phoneRequired && !values.phone?.trim()) {
    throw new BusinessRuleError("Phone number is required by this branch's patient configuration");
  }
  if (setting.emailRequired && !values.email?.trim()) {
    throw new BusinessRuleError("Email is required by this branch's patient configuration");
  }
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

export async function createPatient(actor: AuthUser, input: CreatePatientInput) {
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

  await assertRequiredContactChannels(targetBranchId, {
    phone: input.phone,
    email: input.email,
    whatsapp: input.whatsapp,
  });

  // Resolves the cascade to labels and rejects a broken chain (an upazila that
  // does not belong to the chosen district, both a thana and an upazila, ...).
  const addressChain = await resolveAddressChain(actor, input);

  const data: Omit<Prisma.PatientCreateInput, "patientCode"> = {
    branch: { connect: { id: targetBranchId } },
    name: input.name,
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

  let patient: { id: number; branchId: number; patientCode: string };
  try {
    // Claim the next branch-scoped patient code and create the record in one
    // transaction: if creation fails the sequence increment rolls back too.
    patient = await prisma.$transaction(async (tx) => {
      const patientCode = await generateBusinessCode(tx, CODE_ENTITIES.PATIENT, targetBranchId);
      return tx.patient.create({
        data: { ...data, patientCode },
        select: { id: true, branchId: true, patientCode: true },
      });
    });
  } catch (err) {
    // Final safety net: the unique [branchId, patientCode] index.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError("Patient code already exists in this branch");
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
      branchId: targetBranchId,
      contactCount: input.contacts?.length ?? 0,
    },
    user: actor,
    branchId: targetBranchId,
  });

  return patient;
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

  const scalarFields: Array<keyof UpdatePatientInput> = [
    "name",
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
  ];

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

      // Validate the post-update state so a required channel cannot be
      // cleared by an update that omits it or blanks it out.
      await assertRequiredContactChannels(existing.branchId, {
        phone: input.phone !== undefined ? input.phone : full.phone,
        email: input.email !== undefined ? input.email : full.email,
        whatsapp: input.whatsapp !== undefined ? input.whatsapp : full.whatsapp,
      });
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