// modules/patients/patientDuplicate.ts
// The database side of duplicate detection: turns the comparison rules defined
// in patient.policy.ts into a query against the branch's existing patients.
//
// Kept separate from patient.policy.ts so the policy module stays free of a
// Prisma import — it is shared with prisma/seed.ts, which must not pick up a
// second PrismaClient.

import { prisma } from "../../lib/prisma";
import {
  DUPLICATE_LABELS,
  STRONG_DUPLICATE_FIELDS,
  normalizeEmail,
  normalizeName,
  normalizeNationalId,
  normalizePhone,
  type DuplicateMatch,
  type StrongDuplicateField,
} from "./patient.policy";

export type DuplicateSearch = {
  branchId: number;
  excludePatientId?: number;
  nationalId?: string | null;
  phone?: string | null;
  email?: string | null;
  name: string;
  dateOfBirth?: Date | null;
};

/**
 * Compares the values being registered against the existing records of the same
 * branch. Returns the matches split into the blocking (strong) and the advisory
 * (soft) group so the caller can refuse or merely warn.
 */
export async function findDuplicatePatients(
  params: DuplicateSearch,
): Promise<{ blocking: DuplicateMatch[]; advisory: DuplicateMatch[] }> {
  const { branchId, excludePatientId, nationalId, phone, email, name, dateOfBirth } = params;

  const phoneNorm = phone ? normalizePhone(phone) : null;
  const nationalIdNorm = nationalId ? normalizeNationalId(nationalId) : null;
  const emailNorm = email ? normalizeEmail(email) : null;

  // Only run the query when at least one comparable value was supplied.
  const hasStrong = Boolean(phoneNorm || nationalIdNorm || emailNorm);
  if (!hasStrong && !dateOfBirth) {
    return { blocking: [], advisory: [] };
  }

  // The stored values are not normalized (that would change existing data), so
  // each comparable value is expanded into every spelling that could match it.
  const OR: Record<string, unknown>[] = [];
  if (phoneNorm) {
    for (const candidate of phoneVariants(phone, phoneNorm)) {
      OR.push({ phone: candidate });
    }
  }
  if (nationalIdNorm) {
    for (const candidate of nationalIdVariants(nationalId, nationalIdNorm)) {
      OR.push({ nationalId: candidate });
    }
  }
  if (emailNorm) {
    OR.push({ email: emailNorm });
  }
  // Always widen the fetch to every record sharing the date of birth, even when
  // a strong field is also present: otherwise the advisory (name + date of
  // birth) comparison below would silently run only against the rows the strong
  // fields already pulled in, and a soft match would be missed whenever the
  // caller also typed a fresh phone number.
  if (dateOfBirth) {
    OR.push({ dateOfBirth });
  }

  const rows = await prisma.patient.findMany({
    where: {
      branchId,
      id: excludePatientId ? { not: excludePatientId } : undefined,
      OR,
    },
    select: {
      patientCode: true,
      name: true,
      phone: true,
      email: true,
      nationalId: true,
      dateOfBirth: true,
      deletedAt: true,
    },
  });

  const blocking: DuplicateMatch[] = [];
  const advisory: DuplicateMatch[] = [];
  const seen = new Set<string>();

  const record = (match: DuplicateMatch) => {
    // One entry per existing patient is enough: a patient matching on both
    // phone and NID is still a single conflict to resolve.
    if (seen.has(match.patientCode)) return;
    seen.add(match.patientCode);
    (STRONG_DUPLICATE_FIELDS.includes(match.field as StrongDuplicateField)
      ? blocking
      : advisory
    ).push(match);
  };

  const nameNorm = normalizeName(name);
  const dobKey = dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : null;

  for (const row of rows) {
    const base = {
      patientCode: row.patientCode,
      name: row.name,
      deleted: row.deletedAt !== null,
    };

    if (nationalIdNorm && row.nationalId && normalizeNationalId(row.nationalId) === nationalIdNorm) {
      record({ ...base, field: "nationalId", label: DUPLICATE_LABELS.nationalId });
    }
    if (phoneNorm && row.phone && normalizePhone(row.phone) === phoneNorm) {
      record({ ...base, field: "phone", label: DUPLICATE_LABELS.phone });
    }
    if (emailNorm && row.email && normalizeEmail(row.email) === emailNorm) {
      record({ ...base, field: "email", label: DUPLICATE_LABELS.email });
    }
    if (
      dobKey &&
      row.dateOfBirth &&
      normalizeName(row.name) === nameNorm &&
      row.dateOfBirth.toISOString().slice(0, 10) === dobKey
    ) {
      record({ ...base, field: "nameWithDateOfBirth", label: DUPLICATE_LABELS.nameWithDateOfBirth });
    }
  }

  return { blocking, advisory };
}

/** Every stored spelling that could normalize to `normalized`. */
function phoneVariants(original: string | null | undefined, normalized: string): string[] {
  const values = new Set<string>();
  if (original?.trim()) values.add(original.trim());
  values.add(normalized);
  // Bangladesh numbers are commonly stored with a leading 0 or 880.
  values.add(`0${normalized}`);
  values.add(`880${normalized}`);
  values.add(`+880${normalized}`);
  return [...values];
}

function nationalIdVariants(original: string | null | undefined, normalized: string): string[] {
  const values = new Set<string>();
  if (original?.trim()) values.add(original.trim());
  values.add(normalized);
  values.add(normalized.replace(/(.{4})/g, "$1-").replace(/-$/, ""));
  return [...values];
}