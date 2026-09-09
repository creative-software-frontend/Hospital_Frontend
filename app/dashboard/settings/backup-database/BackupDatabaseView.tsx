// app/dashboard/settings/backup-database/BackupDatabaseView.tsx
// Live "Backup & Database" page backed by GET/PATCH /api/settings/backup,
// GET/DELETE /api/settings/backup/history and POST /api/settings/backup/run.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCcw, FiSave, FiPlay, FiTrash2 } from "react-icons/fi";
import {
  settingsApi,
  type ActiveStatus,
  type BackupFrequency,
  type BackupLog,
  type BackupSetting,
  type BackupType,
  type StorageType,
  BACKUP_FREQUENCIES,
  BACKUP_FREQUENCY_LABELS,
  BACKUP_TYPE_LABELS,
  BACKUP_TYPES,
  STORAGE_TYPE_LABELS,
  STORAGE_TYPES,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

const LOG_STATUS_STYLES: Record<BackupLog["status"], string> = {
  running: "bg-amber-50 text-amber-600 border-amber-200",
  completed: "bg-emerald-50 text-emerald-600 border-emerald-200",
  failed: "bg-red-50 text-red-600 border-red-200",
};

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5.5 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-slate-300"}`}
    >
      <span
        className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all ${checked ? "left-5" : "left-0.5"}`}
      />
    </button>
  );
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function BackupDatabaseView() {
  const [data, setData] = useState<BackupSetting | null>(null);
  const [lastBackup, setLastBackup] = useState<BackupLog | null>(null);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    try {
      const [overview, history] = await Promise.all([
        settingsApi.backup.get(),
        settingsApi.backup.history(),
      ]);
      setData(overview.backupSetting);
      setLastBackup(overview.lastBackup);
      setLogs(history.backups);
      setDirty(false);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const patch = (partial: Partial<BackupSetting>) => {
    setData((prev) => (prev ? { ...prev, ...partial } : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      await settingsApi.backup.update({
        backupType: data.backupType,
        frequency: data.frequency,
        storageType: data.storageType,
        storagePath: data.storagePath,
        retentionDays: data.retentionDays,
        encryptionEnabled: data.encryptionEnabled,
        status: data.status,
      });
      setDirty(false);
      notify("success", "Backup settings saved.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    if (running) return;
    setRunning(true);
    setError("");
    try {
      const { backup } = await settingsApi.backup.run();
      notify("success", `Backup "${backup.fileName}" completed (${backup.fileSize ?? "?"} MB).`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  const removeLog = async (log: BackupLog) => {
    if (deletingId === log.id) return;
    setDeletingId(log.id);
    try {
      await settingsApi.backup.removeLog(log.id);
      notify("success", `Backup log "${log.fileName}" deleted.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Backup & Database</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: automated database backup schedule, storage and retention, plus a
          backup history and on-demand backups.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Backup Configuration</h4>
            <p className="text-xs text-[var(--muted)]">
              {lastBackup
                ? `Last backup: ${formatDate(lastBackup.startedAt)} (${lastBackup.fileName})`
                : "No backups recorded yet"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="p-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              title="Refresh"
            >
              <FiRefreshCcw className="w-4 h-4" />
            </button>
            <button
              onClick={runNow}
              disabled={loading || running}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
              style={{ background: "var(--primary)" }}
            >
              {running ? <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> : <FiPlay className="w-3.5 h-3.5" />}
              {running ? "Backing up..." : "Run Backup Now"}
            </button>
            <button
              onClick={save}
              disabled={loading || !dirty || saving || !data}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
              style={{ background: "var(--primary)" }}
            >
              <FiSave className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {loading || !data ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--muted)]">Automatic Backup</span>
                <Toggle
                  checked={data.status === "active"}
                  onChange={(v) => patch({ status: v ? "active" : ("inactive" as ActiveStatus) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Backup Type</label>
                <select
                  value={data.backupType}
                  onChange={(e) => patch({ backupType: e.target.value as BackupType })}
                  className={INPUT_CLS}
                >
                  {BACKUP_TYPES.map((bt) => (
                    <option key={bt} value={bt}>{BACKUP_TYPE_LABELS[bt]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Frequency</label>
                <select
                  value={data.frequency}
                  onChange={(e) => patch({ frequency: e.target.value as BackupFrequency })}
                  className={INPUT_CLS}
                >
                  {BACKUP_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>{BACKUP_FREQUENCY_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Storage</label>
                <select
                  value={data.storageType}
                  onChange={(e) => patch({ storageType: e.target.value as StorageType })}
                  className={INPUT_CLS}
                >
                  {STORAGE_TYPES.map((s) => (
                    <option key={s} value={s}>{STORAGE_TYPE_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                  Retention (days) — {data.retentionDays} day(s)
                </label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={data.retentionDays}
                  onChange={(e) => patch({ retentionDays: Number(e.target.value) || 1 })}
                  className={INPUT_CLS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Storage Path</label>
                <input
                  value={data.storagePath ?? ""}
                  onChange={(e) => patch({ storagePath: e.target.value })}
                  placeholder="e.g. /backups or s3://bucket/backups"
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--muted)]">Encryption (AES-256)</span>
                <Toggle checked={data.encryptionEnabled} onChange={(v) => patch({ encryptionEnabled: v })} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div>
          <h4 className="text-sm font-extrabold text-[var(--text)]">Backup History</h4>
          <p className="text-xs text-[var(--muted)]">{loading ? "Loading…" : `${logs.length} recorded backup(s)`}</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[720px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                {["Started", "Type", "File", "Size", "Storage", "Status", "Actions"].map((col) => (
                  <th key={col} className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-xs text-[var(--muted)]">No backups yet. Click &quot;Run Backup Now&quot; to create one.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{formatDate(log.startedAt)}</td>
                    <td className="text-[12px] font-bold text-[var(--text)] px-4 py-3 border-b border-[var(--border)] capitalize">{BACKUP_TYPE_LABELS[log.backupType]}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)] font-mono">{log.fileName ?? "—"}</td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{log.fileSize != null ? `${log.fileSize} MB` : "—"}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)] capitalize">
                      {log.storageLocation ? STORAGE_TYPE_LABELS[log.storageLocation as StorageType] ?? log.storageLocation : "—"}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span className={`inline-block text-[10px] font-bold capitalize px-2 py-0.5 rounded-md border ${LOG_STATUS_STYLES[log.status]}`}>{log.status}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <button
                        onClick={() => removeLog(log)}
                        disabled={deletingId === log.id}
                        className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-red-600 hover:border-red-300 disabled:opacity-50 transition-colors"
                        title="Delete backup log"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}