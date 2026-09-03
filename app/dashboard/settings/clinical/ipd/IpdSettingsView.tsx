// app/dashboard/settings/clinical/ipd/IpdSettingsView.tsx
// Live "IPD Settings" page backed by GET/PATCH /api/settings/ipd.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCcw, FiSave } from "react-icons/fi";
import {
  settingsApi,
  type IpdSetting,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

export function IpdSettingsView() {
  const [data, setData] = useState<IpdSetting | null>(null);
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
      const result = await settingsApi.ipd.get();
      setData(result.ipdSetting);
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

  const patch = (partial: Partial<IpdSetting>) => {
    setData((prev) => (prev ? { ...prev, ...partial } : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      await settingsApi.ipd.update({
        admissionFee: data.admissionFee,
        dischargeFee: data.dischargeFee,
        bedCharge: data.bedCharge,
        nursingCharge: data.nursingCharge,
        serviceCharge: data.serviceCharge,
        status: data.status,
      });
      setDirty(false);
      notify("success", "IPD settings saved.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const money = (v: string | null, onChange: (s: string | null) => void) => (
    <input
      type="number"
      min={0}
      step="0.01"
      value={v ?? ""}
      placeholder="0.00"
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      className={INPUT_CLS}
    />
  );

  const fields: { label: string; value: string | null; set: (s: string | null) => void }[] = [
    { label: "Admission Fee (BDT)", value: data?.admissionFee ?? null, set: (v) => patch({ admissionFee: v }) },
    { label: "Discharge Fee (BDT)", value: data?.dischargeFee ?? null, set: (v) => patch({ dischargeFee: v }) },
    { label: "Bed Charge (BDT / day)", value: data?.bedCharge ?? null, set: (v) => patch({ bedCharge: v }) },
    { label: "Nursing Charge (BDT)", value: data?.nursingCharge ?? null, set: (v) => patch({ nursingCharge: v }) },
    { label: "Service Charge (BDT)", value: data?.serviceCharge ?? null, set: (v) => patch({ serviceCharge: v }) },
  ];

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">IPD Settings</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: Inpatient Department admission, discharge and ward charges.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Inpatient Charges</h4>
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
            {fields.map((f) => (
              <div key={f.label} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5">
                <label className="block text-xs font-bold text-[var(--muted)]">{f.label}</label>
                {money(f.value, f.set)}
              </div>
            ))}
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
