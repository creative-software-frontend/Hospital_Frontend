import type { Request } from "express";
import { prisma } from "../lib/prisma";
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
}

/**
 * Writes an append-only audit log entry. Never logs passwords, JWT secrets,
 * cookies or other sensitive credentials.
 *
 * Pass `req` (optional) to capture IP address and user agent automatically.
 */
export async function writeAuditLog(options: AuditOptions & { req?: Request }): Promise<void> {
  const { module, action, tableName, recordId, oldValues, newValues } = options;
  const branchId = options.branchId ?? options.user?.branchId;

  try {
    await prisma.auditLog.create({
      data: {
        userId: options.user?.id ?? null,
        branchId: branchId ?? 0,
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
