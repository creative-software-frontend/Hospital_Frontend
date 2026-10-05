import { getSecurityPolicy } from "../modules/auth/securityPolicy";

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  historyCount: number;
  expiryDays: number;
}

/**
 * Effective password policy read live from SecuritySetting so that the Super
 * Admin settings page actually changes behavior. Delegates to the single policy
 * reader used by authentication so there is exactly one source of truth.
 */
export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const policy = await getSecurityPolicy();
  return {
    minLength: policy.passwordMinLength,
    requireUppercase: policy.passwordRequireUppercase,
    requireLowercase: policy.passwordRequireLowercase,
    requireNumber: policy.passwordRequireNumber,
    requireSymbol: policy.passwordRequireSymbol,
    historyCount: policy.passwordHistoryCount,
    expiryDays: policy.passwordExpiryDays,
  };
}