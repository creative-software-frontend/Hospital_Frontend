// backend/src/utils/audit.ts
import type { Request } from "express";
import { prisma } from "../lib/prisma";
import { getSecurityPolicy } from "../modules/auth/securityPolicy";
import type { AuthUser } from "../types/auth";

export interface AuditContext {
  module: string;
  action: string;
  tableName?: string;
  recordId?: string;
}

interface AuditOptions extends AuditContext {
  oldValues?: unknown;
  newValues?: unknown;
  user?: AuthUser | null;
  branchId?: number;
  ipAddress?: string;
  userAgent?: string;
  /**
   * Security-relevant events (logins, lockouts, password changes, security
   * setting edits) are always recorded even when general audit logging is
   * switched off, otherwise turning the toggle off would erase the evidence
   * of the very events it is meant to review.
   */
  always?: boolean;
}

/**
 * Modules that must never be silenced by the audit logging toggle. Compared
 * case-insensitively because callers historically used camelCase names such as
 * `securitySetting` or `auth`.
 */
const CRITICAL_MODULES = new Set(["auth", "security"]);

export function isCriticalAuditModule(module: string): boolean {
  return CRITICAL_MODULES.has(module.trim().toLowerCase());
}

/**
 * `AuditLog.branchId` is a required foreign key, so a system-level event (an
 * unknown identifier probing the login endpoint, for example) still needs a
 * real branch. Resolve the oldest branch once per process instead of writing an
 * invalid 0 and losing the evidence.
 */
let fallbackBranchId: number | null = null;

async function resolveBranchId(candidate: number | null | undefined): Promise<number> {
  if (typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0) {
    return candidate;
  }
  if (fallbackBranchId) return fallbackBranchId;
  const branch = await prisma.branch.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });
  // If there are genuinely no branches there is nothing valid to write; the
  // catch below handles that case without breaking the caller.
  fallbackBranchId = branch?.id ?? null;
  if (fallbackBranchId === null) {
    throw new Error("No branch exists to attribute this audit entry to");
  }
  return fallbackBranchId;
}

/**
 * Writes an append-only audit log entry. Never logs passwords, JWT secrets,
 * cookies, 2FA secrets or recovery codes.
 *
 * Honors SecuritySetting.auditLogEnabled, with an opt-out for critical
 * security events via `always`.
 *
 * Pass `req` (optional) to capture IP address and user agent automatically.
 */
export async function writeAuditLog(options: AuditOptions & { req?: Request }): Promise<void> {
  const { module, action, tableName, recordId, oldValues, newValues } = options;
  const branchId = options.branchId ?? options.user?.branchId;

  try {
    if (!options.always && !isCriticalAuditModule(module)) {
      const policy = await getSecurityPolicy();
      if (!policy.auditLogEnabled) return;
    }

    await prisma.auditLog.create({
      data: {
        userId: options.user?.id ?? null,
        branchId: await resolveBranchId(branchId),
        module,
        action,
        tableName,
        recordId,
        oldValues: oldValues !== undefined ? JSON.parse(JSON.stringify(oldValues)) : null,
        newValues: newValues !== undefined ? JSON.parse(JSON.stringify(newValues)) : null,
        ipAddress: options.ipAddress ?? options.req?.ip ?? null,
        userAgent: options.userAgent ?? options.req?.headers?.["user-agent"] ?? null,
      },
    });
  } catch (err) {
    // Audit logging must never break the main operation.
    // eslint-disable-next-line no-console
    console.error("[audit] failed to write audit log", err);
  }
}