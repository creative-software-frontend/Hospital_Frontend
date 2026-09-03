// app/dashboard/settings/clinical/prescription/PrescriptionSettingsView.tsx
// Live "Prescription Settings" page backed by GET/PATCH /api/settings/prescription.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCcw, FiSave } from "react-icons/fi";
import {
  settingsApi,
  type PrescriptionSetting,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

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

export function PrescriptionSettingsView() {
  const [data, setData] = useState<PrescriptionSetting | null>(null);
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
      const result = await settingsApi.prescription.get();
      setData(result.prescriptionSetting);
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

  const patch = (partial: Partial<PrescriptionSetting>) => {
    setData((prev) => (prev ? { ...prev, ...partial } : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      await settingsApi.prescription.update({
        showPatientHistory: data.showPatientHistory,
        showDiagnosis: data.showDiagnosis,
        showMedicine: data.showMedicine,
        showDosage: data.showDosage,
        showInstruction: data.showInstruction,
        showDoctorSignature: data.showDoctorSignature,
        showQrCode: data.showQrCode,
        status: data.status,
      });
      setDirty(false);
      notify("success", "Prescription settings saved.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggles: { label: string; desc: string; value: boolean; set: (v: boolean) => void }[] = [
    { label: "Patient History", desc: "Show past history on prescription", value: data?.showPatientHistory ?? true, set: (v) => patch({ showPatientHistory: v }) },
    { label: "Diagnosis", desc: "Show diagnosis codes on prescription", value: data?.showDiagnosis ?? true, set: (v) => patch({ showDiagnosis: v }) },
    { label: "Medicine", desc: "Show prescribed medicines list", value: data?.showMedicine ?? true, set: (v) => patch({ showMedicine: v }) },
    { label: "Dosage", desc: "Show dosage instructions", value: data?.showDosage ?? true, set: (v) => patch({ showDosage: v }) },
    { label: "Instructions", desc: "Show general advice / instructions", value: data?.showInstruction ?? true, set: (v) => patch({ showInstruction: v }) },
    { label: "Doctor Signature", desc: "Show doctor digital signature", value: data?.showDoctorSignature ?? true, set: (v) => patch({ showDoctorSignature: v }) },
    { label: "QR Code", desc: "Show verification QR code", value: data?.showQrCode ?? false, set: (v) => patch({ showQrCode: v }) },
  ];

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Prescription Settings</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: configure what is shown on the digital prescription layout.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Prescription Layout</h4>
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
            {toggles.map((t) => (
              <div key={t.label} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-[var(--text)]">{t.label}</span>
                    <span className="block text-[10px] text-[var(--muted)] mt-0.5">{t.desc}</span>
                  </div>
                  <Toggle checked={t.value} onChange={t.set} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
