// app/patients/constants.ts
// Display labels for enums used by the Patient module. Values are the exact
// backend enum strings; labels are what the UI shows.

import type { BloodGroup, Gender, MaritalStatus, Occupation, PatientStatus } from "@/app/lib/api";

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

export const OCCUPATION_OPTIONS: { value: Occupation; label: string }[] = [
  { value: "Business", label: "Business" },
  { value: "Doctor", label: "Doctor" },
  { value: "Engineer", label: "Engineer" },
  { value: "Farmer", label: "Farmer" },
  { value: "Government Service", label: "Government Service" },
  { value: "Housewife", label: "Housewife" },
  { value: "Laborer", label: "Laborer" },
  { value: "Private Service", label: "Private Service" },
  { value: "Retired", label: "Retired" },
  { value: "Student", label: "Student" },
  { value: "Teacher", label: "Teacher" },
  { value: "Unemployed", label: "Unemployed" },
  { value: "Other", label: "Other" },
];

export const BLOOD_GROUP_OPTIONS: BloodGroup[] = [
  "A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG",
];

export const MARITAL_STATUS_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "WIDOWED", label: "Widowed" },
];

export const PATIENT_STATUS_OPTIONS: { value: PatientStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function bloodGroupLabel(value: BloodGroup | null | undefined): string {
  if (!value) return "—";
  return value.replace("_", " ");
}

export function genderLabel(value: Gender | null | undefined): string {
  if (!value) return "—";
  return GENDER_OPTIONS.find((g) => g.value === value)?.label ?? value;
}

export function occupationLabel(value: Occupation | null | undefined): string {
  if (!value) return "—";
  return OCCUPATION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function maritalStatusLabel(value: MaritalStatus | null | undefined): string {
  if (!value) return "—";
  return MARITAL_STATUS_OPTIONS.find((m) => m.value === value)?.label ?? value;
}