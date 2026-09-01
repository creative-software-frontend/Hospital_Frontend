// app/lib/roles.ts
// Maps the normalized backend role keys (Role.seederKey) to the frontend
// UserRole slugs used by the dashboard, and describes what each frontend role
// may do in the Patient Management module. The backend remains the authority —
// this only controls which buttons/actions the UI surfaces.

import type { UserRole } from "@/app/config/roleConfig";

export const BACKEND_ROLE_TO_USER_ROLE: Record<string, UserRole> = {
  SUPER_ADMIN: "super-admin",
  ADMIN: "admin",
  DOCTOR: "doctor",
  PHARMACIST: "pharmacist",
  PATHOLOGIST: "pathologist",
  RADIOLOGIST: "radiologist",
  ACCOUNTANT: "accountant",
  RECEPTIONIST: "receptionist",
  NURSE: "nurse",
};

/**
 * Picks the first backend role that maps to a dashboard role slug.
 */
export function toFrontendRole(roles: string[] | undefined): UserRole | null {
  if (!roles) return null;
  for (const role of roles) {
    const mapped = BACKEND_ROLE_TO_USER_ROLE[role];
    if (mapped) return mapped;
  }
  return null;
}

export interface PatientCapabilities {
  create: boolean;
  edit: boolean;
  delete: boolean;
  /** Contacts are edited via the patient update permission. */
  manageContacts: boolean;
}

export function patientCapabilities(role: UserRole | null): PatientCapabilities {
  switch (role) {
    case "super-admin":
    case "admin":
      return { create: true, edit: true, delete: true, manageContacts: true };
    case "doctor":
    case "receptionist":
      return { create: true, edit: true, delete: false, manageContacts: true };
    case "nurse":
      return { create: false, edit: false, delete: false, manageContacts: false };
    default:
      return { create: false, edit: false, delete: false, manageContacts: false };
  }
}