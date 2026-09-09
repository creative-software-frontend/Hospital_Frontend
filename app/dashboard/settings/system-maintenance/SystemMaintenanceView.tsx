// app/dashboard/settings/system-maintenance/SystemMaintenanceView.tsx
// Live "System Maintenance" page backed by GET / PATCH /api/settings/system-maintenance
// and POST cache-clear / optimize actions.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCcw, FiSave, FiTrash2, FiDatabase } from "react-icons/fi";
import {
  settingsApi,
  type ActiveStatus,
  type SystemMaintenance,
  type UpdateSystemMaintenanceInput,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
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

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUptime(seconds?: number) {
  if (!seconds) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${Math.floor(seconds % 60)}s`;
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const tones: Record<string, string> = {
    default: "text-[var(--text)]",
    good: "text-emerald-600",
    bad: "text-red-500",
    warn: "text-amber-500",
  };
  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3.5">
      <span className="block text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
        {label}
      </span>
      <span className={`block mt-1 text-sm font-black ${tones[tone]}`}>{value}</span>
    </div>
  );
}

export function SystemMaintenanceView() {
  const [data, setData] = useState<SystemMaintenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningAction, setRunningAction] = useState<"cache" | "optimize" | null>(null);
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
      const { maintenance } = await settingsApi.systemMaintenance.get();
      setData(maintenance);
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

  const patch = (partial: UpdateSystemMaintenanceInput) => {
    setData((prev) => (prev ? { ...prev, ...partial } : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      await settingsApi.systemMaintenance.update({
        systemVersion: data.systemVersion,
        status: data.status,
      });
      setDirty(false);
      notify("success", "System maintenance settings saved.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: "cache" | "optimize") => {
    if (runningAction) return;
    setRunningAction(action);
    setError("");
    try {
      if (action === "cache") {
        await settingsApi.systemMaintenance.clearCache();
        notify("success", "Cache cleared.");
      } else {
        await settingsApi.systemMaintenance.optimize();
        notify("success", "Database optimization queued.");
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setRunningAction(null);
    }
  };

  const systemStatus = !data
    ? "—"
    : data.maintenanceMode
      ? "Maintenance Mode"
      : data.status === "active"
        ? "Healthy"
        : "Disabled";

  const lastMaintenance =
    data && (data.lastCacheClear || data.databaseOptimization)
      ? new Date(
          Math.max(
            data.lastCacheClear ? new Date(data.lastCacheClear).getTime() : 0,
            data.databaseOptimization ? new Date(data.databaseOptimization).getTime() : 0,
          ),
        ).toISOString()
      : null;

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">System Maintenance</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: system health checks, diagnostic tools, cache clearing and
          database optimization.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-sm font-extrabold text-[var(--text)]">System Health</h4>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="p-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            title="Refresh diagnostics"
          >
            <FiRefreshCcw className="w-4 h-4" />
          </button>
        </div>

        {loading || !data ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard
              label="System Status"
              value={systemStatus}
              tone={data.maintenanceMode ? "warn" : systemStatus === "Healthy" ? "good" : "bad"}
            />
            <StatCard label="Uptime" value={formatUptime(data.uptimeSeconds)} />
            <StatCard label="Last Maintenance" value={formatDate(lastMaintenance)} />
            <StatCard
              label="Database Health"
              value={data.dbHealth ?? "—"}
              tone={data.dbHealth === "Optimal" ? "good" : "bad"}
            />
            <StatCard
              label="Cache Usage"
              value={data.cacheEnabled ? "Active" : "Disabled"}
              tone={data.cacheEnabled ? "good" : "default"}
            />
            <StatCard label="Pending Updates" value="None" />
          </div>
        )}
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div>
          <h4 className="text-sm font-extrabold text-[var(--text)]">Maintenance Tools</h4>
          <p className="text-xs text-[var(--muted)]">
            {data
              ? `Version ${data.systemVersion ?? "—"} · Last update ${formatDate(data.lastUpdate)}`
              : "Loading…"}
          </p>
        </div>

        {loading || !data ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-[var(--text)]">Maintenance Mode</span>
                    <span className="block text-[10px] text-[var(--muted)] font-semibold mt-0.5">
                      Temporarily restrict user sign-ins
                    </span>
                  </div>
                  <Toggle
                    checked={data.maintenanceMode}
                    onChange={(v) => patch({ maintenanceMode: v })}
                  />
                </div>
              </div>

              <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-[var(--text)]">Cache Enabled</span>
                    <span className="block text-[10px] text-[var(--muted)] font-semibold mt-0.5">
                      Application cache layer
                    </span>
                  </div>
                  <Toggle checked={data.cacheEnabled} onChange={(v) => patch({ cacheEnabled: v })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">System Version</label>
                <input
                  value={data.systemVersion ?? ""}
                  onChange={(e) => patch({ systemVersion: e.target.value || null })}
                  placeholder="e.g. 2.1.0"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Status</label>
                <select
                  value={data.status}
                  onChange={(e) => patch({ status: e.target.value as ActiveStatus })}
                  className={INPUT_CLS}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={save}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
                style={{ background: "var(--primary)" }}
              >
                <FiSave className="w-3.5 h-3.5" />
                {saving ? "Saving..." : "Save Settings"}
              </button>
              <button
                onClick={() => runAction("cache")}
                disabled={runningAction !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
              >
                {runningAction === "cache" ? (
                  <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                ) : (
                  <FiTrash2 className="w-3.5 h-3.5" />
                )}
                {runningAction === "cache" ? "Clearing..." : "Clear Cache"}
              </button>
              <button
                onClick={() => runAction("optimize")}
                disabled={runningAction !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
              >
                {runningAction === "optimize" ? (
                  <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                ) : (
                  <FiDatabase className="w-3.5 h-3.5" />
                )}
                {runningAction === "optimize" ? "Optimizing..." : "Optimize Database"}
              </button>
            </div>
          </>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}