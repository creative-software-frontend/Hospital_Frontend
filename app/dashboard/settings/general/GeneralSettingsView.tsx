// app/dashboard/settings/general/GeneralSettingsView.tsx
// Live "General Settings" page backed by GET/POST /api/settings/system.
// Reads the "general" setting group and lets authorised users edit values.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCcw, FiSave } from "react-icons/fi";
import {
  settingsApi,
  type SystemSetting,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const GENERAL_GROUP = "general";

const SETTING_LABELS: Record<string, string> = {
  system_name: "System Name",
  version: "Version",
  default_date_format: "Default Date Format",
  default_time_format: "Default Time Format",
  timezone: "Timezone",
  currency: "Currency",
  default_language: "Default Language",
  maintenance_mode: "Maintenance Mode",
};

interface FormState {
  [key: string]: string;
}

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

export function GeneralSettingsView() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [form, setForm] = useState<FormState>({});
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
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
      const result = await settingsApi.system.list();
      const general = result.settings
        .filter((s) => s.settingGroup === GENERAL_GROUP)
        .sort((a, b) => a.settingKey.localeCompare(b.settingKey));
      setSettings(general);
      const next: FormState = {};
      for (const s of general) next[s.settingKey] = s.settingValue ?? "";
      setForm(next);
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

  const updateValue = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      for (const s of settings) {
        const value = form[s.settingKey] ?? "";
        if (value !== (s.settingValue ?? "")) {
          await settingsApi.system.upsert({
            settingGroup: GENERAL_GROUP,
            settingKey: s.settingKey,
            settingValue: value,
            dataType: s.dataType,
            isEncrypted: s.isEncrypted,
          });
        }
      }
      setDirty(false);
      notify("success", "General settings saved.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const ordered = [...settings].sort((a, b) => a.settingKey.localeCompare(b.settingKey));

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
          General Settings
        </h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: system locale, formats, timezone and default preferences.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Application Preferences</h4>
            <p className="text-xs text-[var(--muted)]">
              {loading ? "Loading…" : `${settings.length} setting(s)`}
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
              onClick={save}
              disabled={loading || !dirty || saving}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
              style={{ background: "var(--primary)" }}
            >
              <FiSave className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          </div>
        ) : ordered.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-8 text-center">No general settings found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ordered.map((s) => {
              const isBool = s.dataType === "boolean";
              const label = SETTING_LABELS[s.settingKey] ?? s.settingKey;
              return (
                <div
                  key={s.id}
                  className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5"
                >
                  <label className="block text-xs font-bold text-[var(--muted)]">{label}</label>
                  {isBool ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => updateValue(s.settingKey, form[s.settingKey] === "on" ? "off" : "on")}
                        className={`relative w-10 h-5.5 rounded-full transition-colors ${
                          form[s.settingKey] === "on" ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all ${
                            form[s.settingKey] === "on" ? "left-5" : "left-0.5"
                          }`}
                        />
                      </button>
                      <span className="text-xs font-semibold text-[var(--text)]">
                        {form[s.settingKey] === "on" ? "On" : "Off"}
                      </span>
                    </div>
                  ) : (
                    <input
                      value={form[s.settingKey] ?? ""}
                      onChange={(e) => updateValue(s.settingKey, e.target.value)}
                      className={INPUT_CLS}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}