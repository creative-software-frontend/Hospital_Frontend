// backend/src/modules/settings/backup.scheduler.ts
// In-process scheduler for automatic database backups.
//
// Tick cadence is one minute; each tick asks the BackupSetting whether a run is
// due (daily / weekly / monthly, and hourly too since the UI offers it). No
// external cron dependency is required, and the tick is guarded so overlapping
// backups can never run concurrently.

import { prisma } from "../../lib/prisma";
import { formatBytes, isScheduledRunDue, runBackup } from "./backup.service";

const TICK_MS = 60_000;

let timer: NodeJS.Timeout | null = null;
let inFlight = false;

async function tick(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const setting = await prisma.backupSetting.findFirst({ orderBy: { id: "asc" } });
    if (!setting) return;

    // A setting that has never run has no baseline, which would make it due on
    // every tick. Seed the baseline once so the first automatic backup happens
    // one full interval from now instead of immediately on boot.
    if (setting.lastScheduledRunAt === null && isScheduledRunDue(setting, new Date())) {
      await prisma.backupSetting.update({
        where: { id: setting.id },
        data: { lastScheduledRunAt: new Date() },
      });
      console.log(
        `[backup-scheduler] ${setting.frequency ?? "scheduled"} backups armed; first automatic run in one interval`,
      );
      return;
    }

    if (!isScheduledRunDue(setting, new Date())) return;

    const result = await runBackup(null, "scheduled");
    console.log(
      `[backup-scheduler] automatic ${setting.frequency} backup ${
        result.status === "completed" ? "completed" : "FAILED"
      } (${result.fileName ?? "no file"}${
        result.status === "completed" ? `, ${formatBytes(result.fileSize ?? 0)}` : ""
      })${result.errorMessage ? `: ${result.errorMessage}` : ""}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[backup-scheduler] tick failed: ${message}`);
  } finally {
    inFlight = false;
  }
}

/** Start the scheduler. Safe to call once at process boot. */
export function startBackupScheduler(): void {
  if (timer) return;
  if (process.env.BACKUP_SCHEDULER_ENABLED === "false") {
    console.log("[backup-scheduler] disabled via BACKUP_SCHEDULER_ENABLED=false");
    return;
  }
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  timer.unref();
  // Give the first tick a moment so boot logging is not interleaved.
  setTimeout(() => void tick(), 5_000).unref();
  console.log("[backup-scheduler] started (checks every 60s)");
}

/** Stop the scheduler (used by tests and graceful shutdown). */
export function stopBackupScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

/** Run one tick immediately (used by tests and the "run now" button). */
export async function runBackupSchedulerTick(): Promise<void> {
  await tick();
}