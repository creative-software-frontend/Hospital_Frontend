// modules/patients/patient.policy.ts
// Single source of truth for the branch's Patient Configuration options.
//
// The same five settings are persisted on PatientSetting, edited by the
// Patient Configuration screen and enforced here at patient-creation time.
// Keeping the vocabularies and the comparison rules in one module is what stops
// the UI, the validation layer and the service from drifting apart.

/** Values offered for PatientSetting.defaultPatientType / Patient.patientType. */
export const PATIENT_TYPE_VALUES = ["NEW", "FOLLOWUP", "REFERRAL"] as const;
export type PatientType = (typeof PATIENT_TYPE_VALUES)[number];

/** Values offered for PatientSetting.requireGuardian. */
export const GUARDIAN_REQUIREMENT_VALUES = ["NEVER", "MINORS_ONLY", "ALWAYS"] as const;
export type GuardianRequirement = (typeof GUARDIAN_REQUIREMENT_VALUES)[number];

/** Age at which a patient stops being treated as a minor. */
export const MINOR_AGE_YEARS = 18;

/**
 * Patient-ID prefixes are stored verbatim in the setting, so a branch may hold
 * either "PAT" or "PAT-". Codes are always rendered as `<prefix>-<sequence>`, so
 * the trailing separator is stripped before formatting to keep "PAT" from
 * producing "PAT--000001".
 */
export const DEFAULT_PATIENT_ID_PREFIX = "PAT";

export function normalizeIdPrefix(prefix: string | null | undefined): string {
  const trimmed = (prefix ?? "").trim().replace(/[-\s]+$/, "");
  return trimmed || DEFAULT_PATIENT_ID_PREFIX;
}

export const DEFAULT_PATIENT_SETTINGS = {
  patientIdPrefix: DEFAULT_PATIENT_ID_PREFIX,
  autoGenerateId: true,
  defaultPatientType: "NEW",
  requireGuardian: "MINORS_ONLY",
  duplicateDetection: true,
  phoneRequired: true,
  emailRequired: false,
  whatsappRequired: false,
} as const;

/* ---------------------------------------------------------------------------
 * Duplicate detection rules
 *
 * "duplicateDetection" is a single switch, so the fields it compares and the
 * severity of each comparison are defined here rather than in the UI:
 *
 *   Strong (blocks registration)
 *     nationalId - a government id identifies exactly one person
 *     phone      - the branch's contact number for that person
 *     email      - a mailbox is not shared between two patients in practice
 *
 *   Soft (warns, and can be acknowledged with `overrideDuplicate`)
 *     name + dateOfBirth - a real possibility of a second registration, but
 *                           common names and siblings make this too weak to
 *                           refuse on its own
 *
 * Soft-deleted records are included on purpose: their identifiers were consumed
 * and re-using one silently would hide the previous registration.
 * ------------------------------------------------------------------------- */

export type StrongDuplicateField = "nationalId" | "phone" | "email";

export const STRONG_DUPLICATE_FIELDS: readonly StrongDuplicateField[] = [
  "nationalId",
  "phone",
  "email",
];

export const STRONG_DUPLICATE_LABELS: Record<StrongDuplicateField, string> = {
  nationalId: "national ID",
  phone: "phone number",
  email: "email address",
};

/** Bangladesh NID: case and separator insensitive (e.g. "1234-5678-9012"). */
export function normalizeNationalId(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Phone: digits only, with the country code and trunk zero folded away. */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^(?:880|0)+/, "");
}

/** Email: trimmed and lower-cased. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Name: lower-cased with runs of whitespace collapsed. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export type DuplicateMatch = {
  field: StrongDuplicateField | "nameWithDateOfBirth";
  label: string;
  patientCode: string;
  name: string;
  deleted: boolean;
};

export const DUPLICATE_LABELS = {
  ...STRONG_DUPLICATE_LABELS,
  nameWithDateOfBirth: "name and date of birth",
} as const;

/** True when the patient is under the age of majority on `now`. */
export function isMinor(dateOfBirth: Date | null | undefined, now: Date = new Date()): boolean {
  if (!dateOfBirth) return false;
  const threshold = new Date(dateOfBirth);
  threshold.setUTCFullYear(threshold.getUTCFullYear() + MINOR_AGE_YEARS);
  return threshold.getTime() > now.getTime();
}