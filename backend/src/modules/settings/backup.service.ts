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

/**
 * Resolve the mysqldump binary: env override, common installs, then PATH.
 * A bare command name (e.g. "mysqldump") from the env is kept as-is so the OS
 * resolves it through PATH instead of being rejected by an existsSync check.
 */
export function resolveMysqldump(): string {
  const override = process.env.MYSQLDUMP_PATH?.trim();
  const isPath = override && (path.isAbsolute(override) || override.includes(path.sep));
  if (override && isPath && fs.existsSync(override)) {
    return override;
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

/** Human-readable mysqldump version, or null when it cannot be executed. */
export async function mysqldumpVersion(): Promise<string | null> {
  try {
    const bin = resolveMysqldump();
    const out = await new Promise<string>((resolve) => {
      const child = spawn(bin, ["--version"], { windowsHide: true });
      let buf = "";
      child.stdout.on("data", (d: Buffer) => {
        buf += d.toString();
      });
      child.on("error", () => resolve(""));
      child.on("close", () => resolve(buf.trim()));
    });
    return out || null;
  } catch {
    return null;
  }
}

/**
 * Build mysqldump arguments that work on both MySQL 8 and MariaDB.
 *
 * Notably `--set-gtid-purged` is MySQL-only; MariaDB's client rejects it with
 * "unknown variable" and the whole dump fails. `--no-tablespaces` avoids needing
 * the PROCESS privilege on MySQL 8. Output goes straight to `filePath` via
 * `--result-file` so large dumps are not buffered in memory or piped through
 * the shell.
 */
export function buildMysqldumpArgs(db: DbTarget, filePath: string): string[] {
  return [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.user}`,
    "--single-transaction",
    "--routines",
    "--triggers",
    "--events",
    "--no-tablespaces",
    "--default-character-set=utf8mb4",
    `--result-file=${filePath}`,
    db.database,
  ];
}

/** Run mysqldump, passing the password via MYSQL_PWD instead of argv. */
async function executeMysqldump(
  db: DbTarget,
  filePath: string,
): Promise<{ code: number; stderr: string }> {
  const bin = resolveMysqldump();
  const args = buildMysqldumpArgs(db, filePath);
  const env = { ...process.env };
  if (db.password) {
    env.MYSQL_PWD = db.password;
  }
  return new Promise<{ code: number; stderr: string }>((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true, env });
    let stderrBuf = "";
    child.stderr.on("data", (d: Buffer) => {
      stderrBuf += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 0, stderr: stderrBuf }));
  });
}

export interface DbTarget {
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

/**
 * AuditLog.branchId is a real foreign key, so branch 0 is invalid. System-initiated
 * work (the scheduler) has no actor; attribute it to the first real branch instead
 * of dropping the audit entry.
 */
async function resolveAuditBranchId(user?: AuthUser): Promise<number | undefined> {
  if (user?.branchId) return user.branchId;
  const branch = await prisma.branch.findFirst({ select: { id: true }, orderBy: { id: "asc" } });
  return branch?.id;
}

async function writeLog(params: {
  action: string;
  tableName: string;
  recordId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  user?: AuthUser;
}) {
  const branchId = await resolveAuditBranchId(params.user);
  await writeAuditLog({
    module: "backupSetting",
    action: params.action,
    tableName: params.tableName,
    recordId: params.recordId,
    oldValues: params.oldValues,
    newValues: params.newValues,
    user: params.user ?? null,
    ...(branchId !== undefined ? { branchId } : {}),
  });
}

export async function getBackupOverview() {
  const backupSetting = await getBackupSetting();
  const lastBackup = await prisma.backupLog.findFirst({ orderBy: { startedAt: "desc" } });
  const storageDir = resolveBackupDir(backupSetting.storagePath);
  const version = await mysqldumpVersion();
  return {
    backupSetting,
    lastBackup,
    storageDir,
    mysqldumpAvailable: Boolean(version),
    mysqldumpVersion: version,
    mysqldumpBinary: resolveMysqldump(),
    nextScheduledRunAt: computeNextScheduledRun(backupSetting),
  };
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

/** Backups are system-wide, so the history list is not branch-scoped. */
export async function listBackupLogs(): Promise<unknown> {
  return prisma.backupLog.findMany({ orderBy: { startedAt: "desc" }, take: 100 });
}

/** Human-readable size for notifications and log entries. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** UTC timestamp token used in the dump file name. */
function backupStamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    p(date.getUTCMonth() + 1),
    p(date.getUTCDate()),
    "_",
    p(date.getUTCHours()),
    p(date.getUTCMinutes()),
    p(date.getUTCSeconds()),
  ].join("");
}

/** Does this dump file look like a real SQL dump (not an empty stub)? */
async function verifyDumpFile(filePath: string): Promise<number> {
  if (!fs.existsSync(filePath)) {
    throw new BusinessRuleError(
      "mysqldump reported success but produced no file. Check BACKUP_STORAGE_PATH permissions.",
    );
  }
  const stat = await statAsync(filePath);
  if (stat.size === 0) {
    throw new BusinessRuleError("mysqldump produced an empty file (0 bytes).");
  }
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buf = Buffer.alloc(256);
    const { bytesRead } = await handle.read(buf, 0, 256, 0);
    const head = buf.subarray(0, bytesRead).toString("utf8").trimStart();
    if (!head.startsWith("--")) {
      throw new BusinessRuleError(
        "mysqldump output is not a SQL dump (unexpected file header).",
      );
    }
  } finally {
    await handle.close();
  }
  return stat.size;
}

/** Throw when the frequency enum value is not one we can schedule. */
function normalizeFrequency(frequency: string | null | undefined): string | null {
  if (!frequency) return null;
  const f = frequency.trim().toLowerCase();
  if (["hourly", "daily", "weekly", "monthly", "never", "none", "off"].includes(f)) {
    return f;
  }
  return null;
}

export interface BackupSettingShape {
  status?: string | null;
  frequency?: string | null;
  lastScheduledRunAt?: Date | null;
}

/** Milliseconds until the next automatic run, or null when scheduling is off. */
function intervalMsForFrequency(frequency: string): number {
  switch (frequency) {
    case "hourly":
      return 60 * 60 * 1000;
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
    case "monthly":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

/** When the next scheduled backup is due; null when scheduling is disabled. */
export function computeNextScheduledRun(
  setting: BackupSettingShape,
  from: Date = new Date(),
): Date | null {
  if (setting.status !== "active") return null;
  const frequency = normalizeFrequency(setting.frequency);
  if (!frequency) return null;
  const interval = intervalMsForFrequency(frequency);
  if (interval <= 0) return null;
  const last = setting.lastScheduledRunAt ?? null;
  if (!last) return from;
  return new Date(last.getTime() + interval);
}

/** True when a scheduled backup is due right now. */
export function isScheduledRunDue(
  setting: BackupSettingShape,
  now: Date = new Date(),
): boolean {
  const next = computeNextScheduledRun(setting, now);
  return next !== null && next.getTime() <= now.getTime();
}

/**
 * Actually dump the database to <storageDir>/hospital_backup_<stamp>.sql.
 *
 * Works against MySQL 8 and MariaDB (XAMPP): no MySQL-only flags, password
 * passed via MYSQL_PWD, output written straight to disk with --result-file,
 * and the resulting file is verified to be a real dump before being logged as
 * completed. The returned record reflects the real outcome, so callers can
 * surface failures instead of reporting a phantom success.
 */
export async function runBackup(
  actor: AuthUser | null,
  trigger: "manual" | "scheduled" = "manual",
) {
  const setting = await getBackupSetting();
  const storageDir = resolveBackupDir(setting.storagePath);
  fs.mkdirSync(storageDir, { recursive: true });

  const startedAt = new Date();
  const fileName = `hospital_backup_${backupStamp(startedAt)}.sql`;
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
    const db = parseDbTarget();
    const result = await executeMysqldump(db, filePath);

    if (result.code !== 0) {
      throw new BusinessRuleError(
        result.stderr.trim() || `mysqldump exited with code ${result.code}`,
      );
    }

    const fileSize = await verifyDumpFile(filePath);
    const completedAt = new Date();

    const updated = await prisma.backupLog.update({
      where: { id: created.id },
      data: { status: "completed", fileSize, completedAt },
    });

    await prisma.backupSetting.update({
      where: { id: setting.id },
      data: { lastScheduledRunAt: completedAt },
    });

    await writeLog({
      action: trigger === "scheduled" ? "scheduled-run" : "run",
      tableName: "BackupLog",
      recordId: String(created.id),
      newValues: {
        fileName,
        fileSize,
        humanSize: formatBytes(fileSize),
        storageLocation: storageDir,
        status: "completed",
        trigger,
        ms: completedAt.getTime() - startedAt.getTime(),
      },
      user: actor ?? undefined,
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
      action: trigger === "scheduled" ? "scheduled-run" : "run",
      tableName: "BackupLog",
      recordId: String(created.id),
      newValues: { fileName, status: "failed", trigger, error: message },
      user: actor ?? undefined,
    });
    // A failed scheduled attempt still counts as "we tried"; without this the
    // scheduler would retry the same due backup on every tick.
    if (trigger === "scheduled") {
      await prisma.backupSetting
        .update({ where: { id: setting.id }, data: { lastScheduledRunAt: new Date() } })
        .catch(() => undefined);
    }
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