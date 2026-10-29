// modules/emergency/emergency.validation.ts
// Input rules for the emergency desk.
//
// Emergency intake is deliberately minimal: at the door staff often only have a
// name, an approximate age and a complaint. Everything else — phone, address,
// date of birth — is completed afterwards from the patient record, so the API
// accepts exactly the four fields the intake form shows.

import { z } from "zod";
import { GENDER_VALUES } from "../patients/patient.validation";

export const EMERGENCY_PRIORITY_VALUES = ["CRITICAL", "URGENT", "NON_URGENT"] as const;

/** Empty string from an untouched form field counts as "not supplied". */
const optionalText = (max: number, label = "Value") =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

// `.refine` runs after the transform so an untouched (empty) date is accepted
// while a malformed one is still rejected.
const isoDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use the YYYY-MM-DD format");

/** The identity a triage clerk can capture in seconds. */
export const emergencyPatientSchema = z.object({
  name: z.string().trim().min(1, "Patient name is required").max(255),
  gender: z.enum(GENDER_VALUES).optional(),
  /** Years, converted to an estimated 1 January date of birth. */
  approxAge: z.coerce.number().int().min(0).max(130).optional(),
});

export const createEmergencyCaseSchema = z.object({
  patient: emergencyPatientSchema,
  priority: z.enum(EMERGENCY_PRIORITY_VALUES).default("URGENT"),
  chiefComplaint: optionalText(500, "Chief complaint"),
  /** Registered as "Unknown Male ~40" — renamed once the patient is identified. */
  unidentified: z.boolean().optional(),
});

export type CreateEmergencyCaseInput = z.infer<typeof createEmergencyCaseSchema>;

/** `"true"` / `"false"` from a query string, never the truthiness of a string. */
const booleanFlag = z.enum(["true", "false"]).transform((v) => v === "true");

export const listEmergencyCasesQuerySchema = z.object({
  /** Arrival day (defaults to today in the service). */
  date: isoDate,
  /** Only cases whose patient still misses gender / DOB / phone / address. */
  incomplete: booleanFlag.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type ListEmergencyCasesQuery = z.infer<typeof listEmergencyCasesQuerySchema>;
