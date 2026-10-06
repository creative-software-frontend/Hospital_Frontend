// app/dashboard/settings/patient/PatientConfigurationView.tsx
// Live "Patient Configuration" page backed by GET/PATCH /api/settings/patient.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCcw, FiSave } from "react-icons/fi";
import {
  settingsApi,
  errorMessage,
  ValidationError,
  type PatientSetting,
} from "@/app/lib/api";
import {
  GUARDIAN_REQUIREMENT_OPTIONS,
  PATIENT_TYPE_OPTIONS,
} from "@/app/patients/constants";
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
      setFieldErrors({});
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
    // A corrected value should drop its own message straight away rather than
    // leaving a stale "invalid" under a now-valid field.
    setFieldErrors((prev) => {
      const keys = Object.keys(partial);
      if (!keys.some((k) => prev[k])) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      await settingsApi.patient.update({
        patientIdPrefix: data.patientIdPrefix,
        autoGenerateId: data.autoGenerateId,
        defaultPatientType: data.defaultPatientType,
        requireGuardian: data.requireGuardian,
        duplicateDetection: data.duplicateDetection,
        phoneRequired: data.phoneRequired,
        emailRequired: data.emailRequired,
        whatsappRequired: data.whatsappRequired,
      });
      setDirty(false);
      notify("success", "Patient configuration saved.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ValidationError) {
        setFieldErrors(err.fieldErrors);
        setError(err.message);
      } else {
        setError(errorMessage(err));
      }
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
                disabled={saving}
              />
              <p className="text-[11px] text-[var(--muted)]">
                Codes are issued as{" "}
                <span className="font-bold text-[var(--text)]">
                  {`${(data.patientIdPrefix || "PAT").replace(/[-\s]+$/, "") || "PAT"}-000001`}
                </span>
                . Letters, digits, hyphen and underscore; 2–8 characters.
              </p>
              {fieldErrors.patientIdPrefix && (
                <p className="text-[11px] font-bold text-rose-500">{fieldErrors.patientIdPrefix}</p>
              )}
            </div>

            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5">
              <label className="block text-xs font-bold text-[var(--muted)]">Default Patient Type</label>
              <Select
                value={data.defaultPatientType}
                onChange={(v) => patch({ defaultPatientType: v })}
                options={PATIENT_TYPE_OPTIONS}
              />
              <p className="text-[11px] text-[var(--muted)]">
                Pre-selected on the registration form; staff can still override it per patient.
              </p>
              {fieldErrors.defaultPatientType && (
                <p className="text-[11px] font-bold text-rose-500">{fieldErrors.defaultPatientType}</p>
              )}
            </div>

            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5">
              <label className="block text-xs font-bold text-[var(--muted)]">Require Guardian For</label>
              <Select
                value={data.requireGuardian}
                onChange={(v) => patch({ requireGuardian: v as PatientSetting["requireGuardian"] })}
                options={GUARDIAN_REQUIREMENT_OPTIONS.map(({ value, label }) => ({ value, label }))}
              />
              <p className="text-[11px] text-[var(--muted)]">
                {GUARDIAN_REQUIREMENT_OPTIONS.find((o) => o.value === data.requireGuardian)?.hint}
              </p>
              {fieldErrors.requireGuardian && (
                <p className="text-[11px] font-bold text-rose-500">{fieldErrors.requireGuardian}</p>
              )}
            </div>

            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--muted)]">Auto Generate Patient ID</span>
                <Toggle checked={data.autoGenerateId} onChange={(v) => patch({ autoGenerateId: v })} />
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                {data.autoGenerateId
                  ? "The server issues the next code; the registration form hides the ID field."
                  : "Staff type the ID themselves and the form refuses to submit without one."}
              </p>
              {fieldErrors.autoGenerateId && (
                <p className="text-[11px] font-bold text-rose-500">{fieldErrors.autoGenerateId}</p>
              )}
            </div>

            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--muted)]">Duplicate Detection</span>
                <Toggle checked={data.duplicateDetection} onChange={(v) => patch({ duplicateDetection: v })} />
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                {data.duplicateDetection
                  ? "Refuses a repeated national ID, phone or email; a repeated name and date of birth asks for confirmation."
                  : "No comparison is made — every registration is accepted as given."}
              </p>
              {fieldErrors.duplicateDetection && (
                <p className="text-[11px] font-bold text-rose-500">{fieldErrors.duplicateDetection}</p>
              )}
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
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--muted)]">WhatsApp Number Required</span>
                <Toggle checked={data.whatsappRequired} onChange={(v) => patch({ whatsappRequired: v })} />
              </div>
            </div>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
