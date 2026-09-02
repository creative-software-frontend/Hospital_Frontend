// app/dashboard/settings/patient/PatientConfigurationView.tsx
// Live "Patient Configuration" page backed by GET/PATCH /api/settings/patient.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCcw, FiSave } from "react-icons/fi";
import {
  settingsApi,
  type PatientSetting,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

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

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function PatientConfigurationView() {
  const [data, setData] = useState<PatientSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const result = await settingsApi.patient.get();
      setData(result.patientSetting);
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

  const patch = (partial: Partial<PatientSetting>) => {
    setData((prev) => (prev ? { ...prev, ...partial } : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      await settingsApi.patient.update({
        patientIdPrefix: data.patientIdPrefix,
        autoGenerateId: data.autoGenerateId,
        defaultPatientType: data.defaultPatientType,
        requireGuardian: data.requireGuardian,
        duplicateDetection: data.duplicateDetection,
        phoneRequired: data.phoneRequired,
        emailRequired: data.emailRequired,
      });
      setDirty(false);
      notify("success", "Patient configuration saved.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Patient Configuration</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: patient numbering rules and registration defaults for this branch.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Patient Registration Settings</h4>
            <p className="text-xs text-[var(--muted)]">
              {loading ? "Loading…" : "Applies to this branch"}
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
              disabled={loading || !dirty || saving || !data}
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

        {loading || !data ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5">
              <label className="block text-xs font-bold text-[var(--muted)]">Patient ID Prefix</label>
              <input
                type="text"
                value={data.patientIdPrefix}
                onChange={(e) => patch({ patientIdPrefix: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5">
              <label className="block text-xs font-bold text-[var(--muted)]">Default Patient Type</label>
              <Select
                value={data.defaultPatientType}
                onChange={(v) => patch({ defaultPatientType: v })}
                options={[
                  { value: "NEW", label: "New" },
                  { value: "FOLLOWUP", label: "Follow-up" },
                  { value: "REFERRAL", label: "Referral" },
                ]}
              />
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5">
              <label className="block text-xs font-bold text-[var(--muted)]">Require Guardian For</label>
              <Select
                value={data.requireGuardian}
                onChange={(v) => patch({ requireGuardian: v as PatientSetting["requireGuardian"] })}
                options={[
                  { value: "NEVER", label: "Never" },
                  { value: "MINORS_ONLY", label: "Minors only" },
                  { value: "ALWAYS", label: "Always" },
                ]}
              />
            </div>

            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--muted)]">Auto Generate Patient ID</span>
                <Toggle checked={data.autoGenerateId} onChange={(v) => patch({ autoGenerateId: v })} />
              </div>
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--muted)]">Duplicate Detection</span>
                <Toggle checked={data.duplicateDetection} onChange={(v) => patch({ duplicateDetection: v })} />
              </div>
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--muted)]">Phone Number Required</span>
                <Toggle checked={data.phoneRequired} onChange={(v) => patch({ phoneRequired: v })} />
              </div>
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--muted)]">Email Required</span>
                <Toggle checked={data.emailRequired} onChange={(v) => patch({ emailRequired: v })} />
              </div>
            </div>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
