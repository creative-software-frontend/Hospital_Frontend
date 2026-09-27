// Client-side rules shared by the Patient, Doctor and Nurse forms. Each rule
// mirrors the matching Zod schema in the backend, so a value that the server
// would reject is caught before a round trip. The server keeps the final say and
// its per-field messages are merged into the same error map.

export const NAME_MAX = 255;
export const EMAIL_MAX = 255;
export const PHONE_MAX = 32;
export const ADDRESS_MAX = 500;
export const NATIONAL_ID_MAX = 64;
export const REGISTRATION_NO_MAX = 64;
export const SHORT_TEXT_MAX = 255;
export const MONEY_MAX = 16;
export const MAX_CONTACTS = 20;
export const MAX_AGE_YEARS = 120;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]+$/;
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

export function checkName(value: string): string {
  const v = value.trim();
  if (!v) return "Name is required.";
  if (v.length > NAME_MAX) return `Name must be at most ${NAME_MAX} characters.`;
  return "";
}

export function checkEmail(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length > EMAIL_MAX) return `Email must be at most ${EMAIL_MAX} characters.`;
  if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
  return "";
}

export function checkPhone(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length > PHONE_MAX) return `Phone must be at most ${PHONE_MAX} characters.`;
  if (!PHONE_RE.test(v)) return "Phone can only contain digits, spaces and + - ( ).";
  return "";
}

export function checkMoney(value: string, label: string): string {
  const v = value.trim();
  if (!v) return "";
  if (!MONEY_RE.test(v)) return `${label} must be a number with up to 2 decimals.`;
  if (v.length > MONEY_MAX) return `${label} is too large.`;
  return "";
}

export function checkText(value: string, max: number, label: string): string {
  const v = value.trim();
  if (v.length > max) return `${label} must be at most ${max} characters.`;
  return "";
}

export function checkOptionalId(value: string, label: string): string {
  if (!value.trim()) return "";
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return `Select a valid ${label}.`;
  return "";
}

export function checkDateOfBirth(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Enter a valid date.";
  if (d.getTime() > Date.now()) return "Date of birth cannot be in the future.";
  if (d.getFullYear() < new Date().getFullYear() - MAX_AGE_YEARS) {
    return `Date of birth cannot be more than ${MAX_AGE_YEARS} years ago.`;
  }
  return "";
}

export function addError(errors: Record<string, string>, key: string, message: string) {
  if (message && !errors[key]) errors[key] = message;
}
