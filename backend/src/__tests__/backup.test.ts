import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import {
  buildMysqldumpArgs,
  computeNextScheduledRun,
  formatBytes,
  isScheduledRunDue,
  parseDbTarget,
  resolveBackupDir,
  type DbTarget,
} from "../modules/settings/backup.service";

const db: DbTarget = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "secret",
  database: "hospital_management",
};

describe("backup mysqldump arguments", () => {
  it("never passes the MySQL-only --set-gtid-purged flag (MariaDB rejects it)", () => {
    const args = buildMysqldumpArgs(db, "/tmp/out.sql");
    expect(args.some((a) => a.includes("set-gtid-purged"))).toBe(false);
  });

  it("never passes the password on the command line", () => {
    const args = buildMysqldumpArgs(db, "/tmp/out.sql");
    expect(args.some((a) => a.includes("secret"))).toBe(false);
    expect(args.some((a) => a.startsWith("--password"))).toBe(false);
  });

  it("writes straight to disk with --result-file", () => {
    const args = buildMysqldumpArgs(db, "/tmp/out.sql");
    expect(args).toContain("--result-file=/tmp/out.sql");
  });

  it("keeps flags that both MySQL and MariaDB accept", () => {
    const args = buildMysqldumpArgs(db, "/tmp/out.sql");
    expect(args).toContain("--single-transaction");
    expect(args).toContain("--routines");
    expect(args).toContain("--triggers");
    expect(args).toContain("--no-tablespaces");
    expect(args[args.length - 1]).toBe("hospital_management");
  });
});

describe("parseDbTarget", () => {
  it("reads host, port, user, password and database from DATABASE_URL", () => {
    expect(parseDbTarget("mysql://root:p%40ss@db.local:3307/clinic")).toEqual({
      host: "db.local",
      port: 3307,
      user: "root",
      password: "p@ss",
      database: "clinic",
    });
  });

  it("defaults the port to 3306", () => {
    expect(parseDbTarget("mysql://root@localhost/hospital_management").port).toBe(3306);
  });

  it("rejects a URL without a database name", () => {
    expect(() => parseDbTarget("mysql://root@localhost:3306/")).toThrow(/database name/i);
  });

  it("rejects non-mysql protocols", () => {
    expect(() => parseDbTarget("postgres://root@localhost:5432/clinic")).toThrow(/protocol/i);
  });
});

describe("scheduled backup timing", () => {
  const now = new Date("2026-10-05T12:00:00.000Z");

  it("returns null when the setting is inactive", () => {
    expect(
      computeNextScheduledRun({ status: "inactive", frequency: "daily" }, now),
    ).toBeNull();
  });

  it("returns null when frequency is off", () => {
    expect(computeNextScheduledRun({ status: "active", frequency: "never" }, now)).toBeNull();
    expect(computeNextScheduledRun({ status: "active", frequency: null }, now)).toBeNull();
    expect(computeNextScheduledRun({ status: "active", frequency: "bogus" }, now)).toBeNull();
  });

  it("treats a never-run setting as due immediately", () => {
    expect(isScheduledRunDue({ status: "active", frequency: "daily" }, now)).toBe(true);
  });

  it("is not due again until the interval has elapsed", () => {
    const last = new Date("2026-10-05T11:59:00.000Z");
    expect(isScheduledRunDue({ status: "active", frequency: "daily", lastScheduledRunAt: last }, now)).toBe(
      false,
    );
  });

  it("becomes due once the daily interval passes", () => {
    const last = new Date("2026-10-04T11:00:00.000Z");
    expect(isScheduledRunDue({ status: "active", frequency: "daily", lastScheduledRunAt: last }, now)).toBe(
      true,
    );
  });

  it("supports weekly and monthly intervals", () => {
    const weekly = {
      status: "active",
      frequency: "weekly",
      lastScheduledRunAt: new Date("2026-10-01T00:00:00.000Z"),
    };
    expect(computeNextScheduledRun(weekly, now)?.toISOString()).toBe("2026-10-08T00:00:00.000Z");
    expect(isScheduledRunDue(weekly, now)).toBe(false);
    expect(isScheduledRunDue(weekly, new Date("2026-10-08T00:00:00.000Z"))).toBe(true);

    const monthly = {
      status: "active",
      frequency: "monthly",
      lastScheduledRunAt: new Date("2026-09-20T00:00:00.000Z"),
    };
    expect(isScheduledRunDue(monthly, new Date("2026-10-19T00:00:00.000Z"))).toBe(false);
    expect(isScheduledRunDue(monthly, new Date("2026-10-25T00:00:00.000Z"))).toBe(true);
  });

  it("accepts an hourly schedule", () => {
    const last = new Date("2026-10-05T10:30:00.000Z");
    expect(isScheduledRunDue({ status: "active", frequency: "hourly", lastScheduledRunAt: last }, now)).toBe(
      true,
    );
  });
});

describe("formatBytes", () => {
  it("formats byte counts with a sensible unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB");
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.00 GB");
  });
});

describe("resolveBackupDir", () => {
  const original = process.env.BACKUP_STORAGE_PATH;

  beforeEach(() => {
    process.env.BACKUP_STORAGE_PATH = "/tmp/hms-backups";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.BACKUP_STORAGE_PATH;
    else process.env.BACKUP_STORAGE_PATH = original;
  });

  it("falls back to the configured default when storagePath is blank", () => {
    expect(resolveBackupDir("")).toBe(resolveBackupDir(null));
    expect(resolveBackupDir("   ")).toBe(resolveBackupDir(undefined));
  });

  it("resolves relative paths against the default directory", () => {
    expect(resolveBackupDir("nightly")).toBe(path.join(resolveBackupDir(null), "nightly"));
  });

  it("keeps absolute paths as given", () => {
    const abs = process.platform === "win32" ? "D:\\backups" : "/var/backups";
    expect(resolveBackupDir(abs)).toBe(path.resolve(abs));
  });
});