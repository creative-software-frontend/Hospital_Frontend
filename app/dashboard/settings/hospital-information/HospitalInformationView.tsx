"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiFolder, FiRefreshCcw, FiSave, FiImage } from "react-icons/fi";
import {
  settingsApi,
  type SystemSetting,
  errorMessage,
} from "@/app/lib/api";
import { useAddressCascade } from "@/app/lib/useAddressCascade";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const HOSPITAL_GROUP = "hospital";

/**
 * The location is stored as three labels (not codes) so the saved settings stay
 * readable, and each level is a dropdown fed from the national address tables
 * rather than free text. Division is the parent of District, so it has to be
 * picked first; Thana is the upazila of the chosen district.
 */
const DIVISION_KEY = "hospital_division";
const DISTRICT_KEY = "hospital_district";
const THANA_KEY = "hospital_thana";

interface HospitalField {
  key: string;
  label: string;
  placeholder?: string;
  fullWidth?: boolean;
  /** Rendered as a database-backed <select> instead of a text input. */
  addressLevel?: "division" | "district" | "thana";
}

const HOSPITAL_FIELDS: HospitalField[] = [
  { key: "hospital_name", label: "Hospital Name", placeholder: "e.g. MediCare Hospital Ltd." },
  { key: "hospital_logo", label: "Logo (URL or path)", placeholder: "/images/hospitalogo.png" },
  { key: "hospital_address", label: "Address", placeholder: "Street, area, post code", fullWidth: true },
  { key: "hospital_phone", label: "Phone" },
  { key: "hospital_email", label: "Email", placeholder: "info@hospital.com" },
  { key: "hospital_website", label: "Website", placeholder: "https://www.hospital.com" },
  { key: DIVISION_KEY, label: "Division", addressLevel: "division" },
  { key: DISTRICT_KEY, label: "District", addressLevel: "district" },
  { key: THANA_KEY, label: "Thana", addressLevel: "thana" },
  { key: "hospital_registration_no", label: "Registration No." },
];

interface FormState {
  [key: string]: string;
}

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

const SELECT_CLS = `${INPUT_CLS} disabled:opacity-60 disabled:cursor-not-allowed`;

export function HospitalInformationView() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [form, setForm] = useState<FormState>({});
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [opening, setOpening] = useState(false);
  const prefillDone = useRef(false);

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
      // Re-arm the address prefill: the divisions may finish loading before
      // these settings do, and the saved district/thana can only be resolved
      // once the form actually holds them.
      prefillDone.current = false;
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

  const {
    divisions,
    districts,
    localities,
    divisionsLoading,
    districtsLoading,
    localitiesLoading,
    addressError,
    retryAddress,
    loadDistricts,
    loadLocalities,
    resetDistricts,
    resetLocalities,
  } = useAddressCascade();

  // Picking a level invalidates everything below it, so the stored children are
  // dropped and their option lists are reloaded or cleared.
  const onDivisionChange = (label: string) => {
    resetDistricts();
    resetLocalities();
    setForm((prev) => ({ ...prev, [DIVISION_KEY]: label, [DISTRICT_KEY]: "", [THANA_KEY]: "" }));
    const code = divisions.find((d) => d.label === label)?.code;
    if (code) loadDistricts(code);
  };

  const onDistrictChange = (label: string) => {
    resetLocalities();
    setForm((prev) => ({ ...prev, [DISTRICT_KEY]: label, [THANA_KEY]: "" }));
    const code = districts.find((d) => d.label === label)?.code;
    if (code) loadLocalities(code);
  };

  // The settings store labels, so the child lists have to be fetched before a
  // saved district/thana can be shown as selected. `load` re-arms prefillDone so
  // this still runs once the settings arrive after the divisions do.
  useEffect(() => {
    if (prefillDone.current || divisionsLoading) return;
    const savedDivision = form[DIVISION_KEY];
    const divisionCode = savedDivision
      ? divisions.find((d) => d.label === savedDivision)?.code
      : undefined;
    prefillDone.current = true;
    if (!divisionCode) return;
    loadDistricts(divisionCode);
    const savedDistrict = form[DISTRICT_KEY];
    const districtCode = savedDistrict
      ? districts.find((d) => d.label === savedDistrict)?.code
      : undefined;
    if (districtCode) loadLocalities(districtCode);
  }, [divisions, divisionsLoading, form, loadDistricts, loadLocalities]);

  useEffect(() => {
    if (!form[DISTRICT_KEY] || districts.length === 0 || localities.length > 0) return;
    const code = districts.find((d) => d.label === form[DISTRICT_KEY])?.code;
    if (code) loadLocalities(code);
  }, [districts, form, localities.length, loadLocalities]);

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

  /**
   * Asks the backend to open the logo's folder in the OS file manager on the
   * machine running the server. It is a development convenience: the backend
   * confines the path to public/ and refuses the call in production, so any
   * refusal is surfaced instead of swallowed.
   */
  const openFolder = async () => {
    if (!logoValue) return;
    setOpening(true);
    try {
      const { revealed } = await settingsApi.system.revealPath(logoValue);
      notify("success", `Opened ${revealed.folder}`);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setOpening(false);
    }
  };

  const pendingCount = useMemo(() => {
    return HOSPITAL_FIELDS.filter(
      (f) => (form[f.key] ?? "") !== (settings.find((s) => s.settingKey === f.key)?.settingValue ?? ""),
    ).length;
  }, [form, settings]);

  type AddressLevel = NonNullable<HospitalField["addressLevel"]>;

  const addressOptions = (level: AddressLevel) => {
    if (level === "division") return divisions.map((d) => ({ value: d.label, text: d.label }));
    if (level === "district") return districts.map((d) => ({ value: d.label, text: d.label }));
    // The upazila level doubles as the thana, so its label is what gets stored.
    return localities.map((l) => ({
      value: l.label,
      text: l.bnName ? `${l.label} (${l.bnName})` : l.label,
    }));
  };

  const addressPlaceholder = (level: AddressLevel) => {
    if (level === "division") {
      return divisionsLoading ? "Loading divisions..." : "Select division";
    }
    if (level === "district") {
      if (!form[DIVISION_KEY]) return "Select division first";
      return districtsLoading ? "Loading districts..." : "Select district";
    }
    if (!form[DISTRICT_KEY]) return "Select district first";
    return localitiesLoading ? "Loading thanas..." : "Select thana";
  };

  const addressDisabled = (level: AddressLevel) => {
    if (level === "division") return loading || divisionsLoading;
    if (level === "district") return loading || !form[DIVISION_KEY] || districtsLoading;
    return loading || !form[DISTRICT_KEY] || localitiesLoading;
  };

  const renderAddressSelect = (field: HospitalField) => {
    const level = field.addressLevel as AddressLevel;
    const current = form[field.key] ?? "";
    const options = addressOptions(level);
    // A saved label that is no longer in the address data is still offered, so
    // refreshing the page can never silently blank what is already stored.
    const legacy =
      current && !options.some((o) => o.value === current)
        ? { value: current, text: `${current} (not in address data)` }
        : null;

    const onChange = (value: string) => {
      if (level === "division") onDivisionChange(value);
      else if (level === "district") onDistrictChange(value);
      else updateValue(THANA_KEY, value);
    };

    return (
      <select
        className={SELECT_CLS}
        value={current}
        onChange={(e) => onChange(e.target.value)}
        disabled={addressDisabled(level)}
      >
        <option value="">{addressPlaceholder(level)}</option>
        {legacy && <option value={legacy.value}>{legacy.text}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.text}
          </option>
        ))}
      </select>
    );
  };

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

        {addressError && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">
            <span>{addressError}</span>
            <button
              type="button"
              onClick={retryAddress}
              className="rounded-lg border border-red-300/70 px-2 py-1 font-bold hover:bg-red-500/30"
            >
              Retry
            </button>
          </div>
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
                {f.addressLevel ? (
                  renderAddressSelect(f)
                ) : (
                  <input
                    value={form[f.key] ?? ""}
                    onChange={(e) => updateValue(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className={INPUT_CLS}
                  />
                )}
                {f.key === "hospital_logo" && logoValue && (
                  <div className="flex flex-wrap items-center gap-3 pt-1">
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
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={openFolder}
                        disabled={opening}
                        title="Open the folder holding this logo in File Explorer on the PC running the server"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[10px] font-bold text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--text)] disabled:opacity-60 transition-colors shrink-0"
                      >
                        <FiFolder className="w-3 h-3 shrink-0" />
                        {opening ? "Opening..." : "Open folder"}
                      </button>
                      <p className="text-[10px] text-[var(--muted)]">
                        Opens the logo&apos;s folder in File Explorer on the server PC.
                      </p>
                    </div>
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