// backend/src/modules/settings/backup.service.ts
// Real database backup management:
//  - Generates a SQL dump via `mysqldump` into the configured storage path
//  - Records real file sizes and durations in BackupLog
//  - Supports download (streaming the actual file), single delete, and
//    clear-all (removing both records and physical files)
//  - Honors the user-configured storagePath (otherwise a safe default)

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { prisma } from "../../lib/prisma";
import { BusinessRuleError, NotFoundError } from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import type { AuthUser } from "../../types/auth";
import type { UpdateBackupSettingInput } from "./setting.validation";

const statAsync = promisify(fs.stat);

/** Default backup directory when the configured storagePath is empty. */
export function defaultBackupDir(): string {
  return process.env.BACKUP_STORAGE_PATH || path.resolve(process.cwd(), "storage", "backups");
}

/**
 * Resolve the effective backup directory. An empty/blank configured path falls
 * back to the default; relative paths are resolved against the default dir.
 * The result is made safe (no trailing separators, no .. escapes).
 */
export function resolveBackupDir(storagePath: string | null | undefined): string {
  const trimmed = storagePath?.trim();
  if (!trimmed) {
    return path.resolve(defaultBackupDir());
  }
  const base = path.resolve(defaultBackupDir());
  const resolved = path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(base, trimmed);
  return resolved;
}

/** Resolve the mysqldump binary: env override, common installs, then PATH. */
export function resolveMysqldump(): string {
  if (process.env.MYSQLDUMP_PATH && fs.existsSync(process.env.MYSQLDUMP_PATH)) {
    return process.env.MYSQLDUMP_PATH;
  }
  const candidates = [
    "C:\\xampp\\mysql\\bin\\mysqldump.exe",
    "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe",
    "C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysqldump.exe",
    "C:\\MySQL\\bin\\mysqldump.exe",
    "/usr/bin/mysqldump",
    "/usr/local/bin/mysqldump",
    "/opt/homebrew/bin/mysqldump",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return "mysqldump";
}

interface DbTarget {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** Parse DATABASE_URL (mysql://user:pass@host:port/db). */
export function parseDbTarget(url?: string): DbTarget {
  const raw = url || process.env.DATABASE_URL || "mysql://root@localhost:3306/hospital_management";
  const parsed = new URL(raw);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (parsed.protocol !== "mysql:" && parsed.protocol !== "mariadb:") {
    throw new BusinessRuleError(`Unsupported database protocol "${parsed.protocol}" for backups`);
  }
  if (!database) {
    throw new BusinessRuleError("DATABASE_URL is missing a database name; cannot run backups");
  }
  return {
    host: parsed.hostname || "localhost",
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username || "root"),
    password: decodeURIComponent(parsed.password || ""),
    database,
  };
}

function safePathWithin(root: string, filePath: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(filePath));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

async function getBackupSetting() {
  let setting = await prisma.backupSetting.findFirst({ orderBy: { id: "asc" } });
  if (!setting) {
    setting = await prisma.backupSetting.create({
      data: {
        backupType: "full",
        frequency: "daily",
        storageType: "cloud_local",
        storagePath: "",
        retentionDays: 30,
        encryptionEnabled: true,
        status: "active",
      },
    });
  }
  return setting;
}

async function writeLog(params: {
  action: string;
  tableName: string;
  recordId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  user?: AuthUser;
}) {
  await writeAuditLog({
    module: "backupSetting",
    action: params.action,
    tableName: params.tableName,
    recordId: params.recordId,
    oldValues: params.oldValues,
    newValues: params.newValues,
    user: params.user ?? null,
    branchId: params.user?.branchId ?? 0,
  });
}

export async function getBackupOverview() {
  const backupSetting = await getBackupSetting();
  const lastBackup = await prisma.backupLog.findFirst({ orderBy: { startedAt: "desc" } });
  const storageDir = resolveBackupDir(backupSetting.storagePath);
  const mysqldumpAvailable = resolveMysqldump() !== "";
  return { backupSetting, lastBackup, storageDir, mysqldumpAvailable };
}

export async function updateBackupSetting(actor: AuthUser, input: UpdateBackupSettingInput) {
  const current = await getBackupSetting();
  const updated = await prisma.backupSetting.update({
    where: { id: current.id },
    data: { ...input },
  });

  await writeLog({
    action: "update",
    tableName: "BackupSetting",
    recordId: String(current.id),
    oldValues: {
      backupType: current.backupType,
      frequency: current.frequency,
      retentionDays: current.retentionDays,
      storageType: current.storageType,
      storagePath: current.storagePath,
    },
    newValues: { ...input },
    user: actor,
  });
  return updated;
}

export async function listBackupLogs(_actor: AuthUser) {
  return prisma.backupLog.findMany({ orderBy: { startedAt: "desc" }, take: 100 });
}

/** Actually dump the database to <storageDir>/hospital_backup_<stamp>.sql. */
export async function runBackup(actor: AuthUser) {
  const setting = await getBackupSetting();
  const storageDir = resolveBackupDir(setting.storagePath);
  fs.mkdirSync(storageDir, { recursive: true });

  const startedAt = new Date();
  const stamp = [
    startedAt.getFullYear(),
    String(startedAt.getMonth() + 1).padStart(2, "0"),
    String(startedAt.getDate()).padStart(2, "0"),
    "_",
    String(startedAt.getHours()).padStart(2, "0"),
    String(startedAt.getMinutes()).padStart(2, "0"),
    String(startedAt.getSeconds()).padStart(2, "0"),
  ].join("");
  const fileName = `hospital_backup_${stamp}.sql`;
  const filePath = path.join(storageDir, fileName);

  const created = await prisma.backupLog.create({
    data: {
      backupType: setting.backupType,
      fileName,
      storageLocation: storageDir,
      status: "running",
      startedAt,
    },
  });

  try {
    const bin = resolveMysqldump();
    const db = parseDbTarget();
    const args = [
      `--host=${db.host}`,
      `--port=${db.port}`,
      `--user=${db.user}`,
      `--password=${db.password}`,
      "--single-transaction",
      "--routines",
      "--triggers",
      "--set-gtid-purged=OFF",
      db.database,
    ];

    const result = await new Promise<{ code: number; stderr: string }>((resolve, reject) => {
      const child = spawn(bin, args, { windowsHide: true });
      let stderrBuf = "";
      child.stderr.on("data", (d: Buffer) => {
        stderrBuf += d.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code: code ?? 0, stderr: stderrBuf }));
    });

    if (result.code !== 0) {
      throw new BusinessRuleError(
        result.stderr.trim() || `mysqldump exited with code ${result.code}`,
      );
    }

    const fileStat = await statAsync(filePath);
    const completedAt = new Date();
    await writeLog({
      action: "run",
      tableName: "BackupLog",
      recordId: String(created.id),
      newValues: {
        fileName,
        fileSize: fileStat.size,
        storageLocation: storageDir,
        status: "completed",
        ms: completedAt.getTime() - startedAt.getTime(),
      },
      user: actor,
    });

    const updated = await prisma.backupLog.update({
      where: { id: created.id },
      data: { status: "completed", fileSize: fileStat.size, completedAt },
    });

    await applyRetention(setting.retentionDays, storageDir);
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backup failed";
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // ignore cleanup errors
    }
    const failed = await prisma.backupLog.update({
      where: { id: created.id },
      data: { status: "failed", errorMessage: message, completedAt: new Date() },
    });
    await writeLog({
      action: "run",
      tableName: "BackupLog",
      recordId: String(created.id),
      newValues: { fileName, status: "failed", error: message },
      user: actor,
    });
    return failed;
  }
}

/** Delete backups older than retentionDays (records + files). */
async function applyRetention(retentionDays: number | null, storageDir: string): Promise<void> {
  if (!retentionDays || retentionDays <= 0) return;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const expired = await prisma.backupLog.findMany({
    where: { startedAt: { lt: cutoff }, status: "completed" },
    select: { id: true, fileName: true, storageLocation: true },
  });
  for (const log of expired) {
    await removeBackupFile(log.fileName, log.storageLocation ?? storageDir).catch(() => undefined);
  }
  if (expired.length > 0) {
    await prisma.backupLog.deleteMany({ where: { id: { in: expired.map((l) => l.id) } } });
  }
}

async function removeBackupFile(fileName: string | null, storageDir: string): Promise<void> {
  if (!fileName) return;
  const filePath = path.join(path.resolve(storageDir), fileName);
  if (!safePathWithin(storageDir, filePath)) return;
  await fs.promises.rm(filePath, { force: true });
}

/** Resolve the on-disk file for a backup log (throws NotFound when missing). */
export async function resolveBackupFile(id: number): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const log = await prisma.backupLog.findUnique({ where: { id } });
  if (!log) {
    throw new NotFoundError("Backup record not found");
  }
  if (!log.fileName) {
    throw new NotFoundError("Backup file is missing for this record");
  }
  const storageDir = log.storageLocation ?? resolveBackupDir(null);
  const filePath = path.join(path.resolve(storageDir), log.fileName);
  if (!safePathWithin(storageDir, filePath) || !fs.existsSync(filePath)) {
    throw new NotFoundError("Backup file not found on disk");
  }
  const stat = await statAsync(filePath);
  return { filePath, fileName: log.fileName, fileSize: stat.size };
}

/** Delete one backup: physical file (if present) + record. */
export async function deleteBackupLog(actor: AuthUser, id: number) {
  const current = await prisma.backupLog.findUnique({ where: { id } });
  if (!current) {
    throw new NotFoundError("Backup log not found");
  }

  const storageDir = current.storageLocation ?? resolveBackupDir(null);
  if (current.fileName) {
    await removeBackupFile(current.fileName, storageDir).catch(() => undefined);
  }

  await prisma.backupLog.delete({ where: { id } });

  await writeLog({
    action: "delete",
    tableName: "BackupLog",
    recordId: String(id),
    oldValues: { fileName: current.fileName, status: current.status },
    user: actor,
  });
}

/** Delete every backup record and any physical files still on disk. */
export async function clearBackupLogs(actor: AuthUser) {
  const all = await prisma.backupLog.findMany({
    select: { id: true, fileName: true, storageLocation: true },
  });

  for (const log of all) {
    if (log.fileName) {
      await removeBackupFile(log.fileName, log.storageLocation ?? resolveBackupDir(null)).catch(
        () => undefined,
      );
    }
  }

  const result = await prisma.backupLog.deleteMany({});

  await writeLog({
    action: "clear",
    tableName: "BackupLog",
    recordId: "all",
    oldValues: { count: all.length },
    newValues: { deleted: result.count },
    user: actor,
  });
  return { deleted: result.count };
}

// Internal helper, re-exported for the settings controller.
export { getBackupSetting };