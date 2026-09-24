"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCcw, FiSave, FiImage } from "react-icons/fi";
import {
  settingsApi,
  type SystemSetting,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const HOSPITAL_GROUP = "hospital";

interface HospitalField {
  key: string;
  label: string;
  placeholder?: string;
  fullWidth?: boolean;
}

const HOSPITAL_FIELDS: HospitalField[] = [
  { key: "hospital_name", label: "Hospital Name", placeholder: "e.g. MediCare Hospital Ltd." },
  { key: "hospital_logo", label: "Logo (URL or path)", placeholder: "/images/hospitalogo.png" },
  { key: "hospital_address", label: "Address", placeholder: "Street, area, post code", fullWidth: true },
  { key: "hospital_phone", label: "Phone" },
  { key: "hospital_email", label: "Email", placeholder: "info@hospital.com" },
  { key: "hospital_website", label: "Website", placeholder: "https://www.hospital.com" },
  { key: "hospital_district", label: "District" },
  { key: "hospital_thana", label: "Thana" },
  { key: "hospital_registration_no", label: "Registration No." },
];

interface FormState {
  [key: string]: string;
}

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

export function HospitalInformationView() {
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
      const hospital = result.settings.filter((s) => s.settingGroup === HOSPITAL_GROUP);
      setSettings(hospital);
      const next: FormState = {};
      for (const f of HOSPITAL_FIELDS) {
        const found = hospital.find((s) => s.settingKey === f.key);
        next[f.key] = found?.settingValue ?? "";
      }
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

  const logoValue = form.hospital_logo?.trim() ?? "";

  const updateValue = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      for (const f of HOSPITAL_FIELDS) {
        const existing = settings.find((s) => s.settingKey === f.key);
        const current = form[f.key] ?? "";
        if (current !== (existing?.settingValue ?? "")) {
          await settingsApi.system.upsert({
            settingGroup: HOSPITAL_GROUP,
            settingKey: f.key,
            settingValue: current,
            dataType: "string",
            isEncrypted: false,
          });
        }
      }
      setDirty(false);
      notify("success", "Hospital information saved.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = useMemo(() => {
    return HOSPITAL_FIELDS.filter(
      (f) => (form[f.key] ?? "") !== (settings.find((s) => s.settingKey === f.key)?.settingValue ?? ""),
    ).length;
  }, [form, settings]);

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
          Hospital Configuration
        </h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Central hospital identity — name, logo, contact and location. This is the single
          source used across the system; it is not duplicated elsewhere.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Hospital Information</h4>
            <p className="text-xs text-[var(--muted)]">
              {loading ? "Loading…" : `${settings.length} of ${HOSPITAL_FIELDS.length} field(s) saved`}
              {!loading && pendingCount > 0 && ` • ${pendingCount} unsaved`}
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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {HOSPITAL_FIELDS.map((f) => (
              <div
                key={f.key}
                className={`bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5 ${f.fullWidth ? "sm:col-span-2" : ""}`}
              >
                <label className="block text-xs font-bold text-[var(--muted)]">
                  {f.label}
                </label>
                <input
                  value={form[f.key] ?? ""}
                  onChange={(e) => updateValue(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className={INPUT_CLS}
                />
                {f.key === "hospital_logo" && logoValue && (
                  <div className="flex items-center gap-3 pt-1">
                    <div className="w-14 h-14 rounded-lg border border-[var(--border)] bg-white overflow-hidden flex items-center justify-center shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoValue}
                        alt="Hospital logo preview"
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.opacity = "0.3";
                        }}
                        onLoad={(e) => {
                          (e.target as HTMLImageElement).style.opacity = "1";
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--muted)]">
                      Logo preview. Use a URL or a path under /public.
                    </span>
                  </div>
                )}
                {f.key === "hospital_logo" && !logoValue && (
                  <div className="flex items-center gap-2 pt-1 text-[10px] text-[var(--muted)]">
                    <FiImage className="w-3.5 h-3.5" />
                    <span>No logo set. Add a URL or path under /public.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}