import { prisma } from "../lib/prisma";

export interface PasswordPolicy {
  minLength: number;
}

/**
 * Effective password policy read live from SecuritySetting so that the Super
 * Admin settings page actually changes behavior. Falls back to safe defaults.
 */
export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const setting = await prisma.securitySetting.findFirst({ orderBy: { id: "asc" } });
  return {
    minLength: setting?.passwordMinLength ?? 8,
  };
}