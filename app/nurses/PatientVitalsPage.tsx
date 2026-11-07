// app/nurses/PatientVitalsPage.tsx
// Nursing Management → Patient Monitoring: bedside vitals log. A nurse picks a
// patient, records one observation (temperature, pulse, BP, respiration, SpO2,
// blood sugar, weight) and reviews the history. The backend decorates every row
// with `flags` / `abnormal` using adult reference ranges so the colour coding
// lives in one place.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiActivity,
  FiChevronLeft,
  FiChevronRight,
  FiHeart,
  FiTrash2,
} from "react-icons/fi";
import {
  errorMessage,
  patientVitalApi,
  type CreatePatientVitalInput,
  type NurseRecord,
  type PatientListRecord,
  type PatientVitalRecord,
  type PatientVitalSummary,
} from "@/app/lib/api";
import { PatientSearchPicker } from "@/app/patients/PatientSearchPicker";
import { ToastViewport, type ToastItem } from "@/app/patients/Toast";
import { NursePicker } from "@/app/nurses/NursePicker";

const PAGE_SIZE = 8;

const nowInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const isFuture = (value: string) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now() + 60_000;
};

type FormState = {
  recordedAt: string;
  temperature: string;
  pulse: string;
  systolic: string;
  diastolic: string;
  respiratoryRate: string;
  spo2: string;
  bloodSugar: string;
  weight: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  recordedAt: nowInput(),
  temperature: "",
  pulse: "",
  systolic: "",
  diastolic: "",
  respiratoryRate: "",
  spo2: "",
  bloodSugar: "",
  weight: "",
  notes: "",
});

const NUMBER_FIELDS = {
  temperature: { min: 30, max: 45, label: "Temperature", unit: "°C" },
  pulse: { min: 20, max: 250, label: "Pulse", unit: "bpm" },
  systolic: { min: 50, max: 300, label: "Systolic pressure", unit: "mmHg" },
  diastolic: { min: 20, max: 200, label: "Diastolic pressure", unit: "mmHg" },
  respiratoryRate: { min: 4, max: 80, label: "Respiratory rate", unit: "/min" },
  spo2: { min: 50, max: 100, label: "SpO₂", unit: "%" },
  bloodSugar: { min: 10, max: 800, label: "Blood sugar", unit: "mg/dL" },
  weight: { min: 0.5, max: 500, label: "Weight", unit: "kg" },
} as const;

type NumberField = keyof typeof NUMBER_FIELDS;

const numberValue = (value: string | number | null) => {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const prettyNumber = (value: string | number | null) => {
  const parsed = numberValue(value);
  return parsed === null ? null : String(parsed);
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

type Measurement = { label: string; value: string; unit: string; flagKeys?: string[] };

const measurementsOf = (row: PatientVitalRecord): Measurement[] => {
  const list: Measurement[] = [];
  const push = (label: string, raw: string | number | null, unit: string, flagKeys?: string[]) => {
    const value = prettyNumber(raw);
    if (value !== null) list.push({ label, value, unit, flagKeys });
  };
  push("Temp", row.temperature, "°C", ["Temperature"]);
  push("Pulse", row.pulse, "bpm", ["Pulse"]);
  if (row.systolic !== null || row.diastolic !== null) {
    list.push({
      label: "BP",
      value: `${prettyNumber(row.systolic) ?? "—"}/${prettyNumber(row.diastolic) ?? "—"}`,
      unit: "mmHg",
      flagKeys: ["Systolic BP", "Diastolic BP"],
    });
  }
  push("Resp", row.respiratoryRate, "/min", ["Respiration"]);
  push("SpO₂", row.spo2, "%", ["SpO2"]);
  push("Sugar", row.bloodSugar, "mg/dL", ["Blood sugar"]);
  push("Weight", row.weight, "kg");
  return list;
};

const isFlagged = (row: PatientVitalRecord, flagKeys?: string[]) =>
  !!flagKeys && flagKeys.some((key) => row.flags.some((flag) => flag.startsWith(key)));

export function PatientVitalsPage({ onBack }: { onBack: () => void }) {
  const [patient, setPatient] = useState<PatientListRecord | null>(null);
  const [rows, setRows] = useState<PatientVitalRecord[]>([]);
  const [summary, setSummary] = useState<PatientVitalSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedNurse, setSelectedNurse] = useState<NurseRecord | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<NumberField | "recordedAt" | "general", string>>>({});
  const [saving, setSaving] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((message: string, kind: ToastItem["kind"] = "success") => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current.slice(-3), { id, kind, message }]);
  }, []);

  // Load the selected patient's readings (deferred a tick so the effect body
  // never calls setState synchronously).
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!patient) {
        setRows([]);
        setSummary(null);
        setTotalPages(1);
        setLoading(false);
        return;
      }
      setLoading(true);
      patientVitalApi
        .list({
          patientId: patient.id,
          page,
          limit: PAGE_SIZE,
          from: from || undefined,
          to: to || undefined,
        })
        .then((result) => {
          if (!active) return;
          setRows(result.data);
          setSummary(result.summary);
          setTotalPages(result.pagination.totalPages || 1);
          setError("");
        })
        .catch((err) => {
          if (active) setError(errorMessage(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [patient, page, from, to, refreshKey]);

  const pickPatient = (next: PatientListRecord) => {
    setPatient(next);
    setRows([]);
    setSummary(null);
    setPage(1);
    setFrom("");
    setTo("");
    setForm(emptyForm());
    setSelectedNurse(null);
    setFieldErrors({});
    setError("");
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key !== "notes" && key !== "recordedAt") {
      setFieldErrors((current) => ({ ...current, [key]: undefined, general: undefined }));
    }
    if (key === "systolic" || key === "diastolic") {
      setFieldErrors((current) => ({ ...current, systolic: undefined, diastolic: undefined, general: undefined }));
    }
  };

  const save = async () => {
    if (!patient) return;
    const errors: Partial<Record<NumberField | "recordedAt" | "general", string>> = {};

    if (!form.recordedAt) errors.recordedAt = "Recorded at is required.";
    else if (isFuture(form.recordedAt)) errors.recordedAt = "Recorded at cannot be in the future.";

    const payload: CreatePatientVitalInput = {
      patientId: patient.id,
      nurseId: selectedNurse?.id ?? null,
      notes: form.notes.trim() || null,
    };

    if (form.recordedAt) payload.recordedAt = new Date(form.recordedAt).toISOString();

    let measurements = 0;
    (Object.keys(NUMBER_FIELDS) as NumberField[]).forEach((key) => {
      const raw = form[key].trim();
      if (!raw) return;
      const value = Number(raw);
      const limit = NUMBER_FIELDS[key];
      if (!Number.isFinite(value)) {
        errors[key] = `${limit.label} must be a number.`;
        return;
      }
      if (value < limit.min || value > limit.max) {
        errors[key] = `${limit.label} must be between ${limit.min} and ${limit.max} ${limit.unit}.`;
        return;
      }
      measurements += 1;
      payload[key] = value;
    });

    if (payload.systolic !== undefined && payload.diastolic !== undefined && payload.systolic <= payload.diastolic) {
      errors.systolic = "Systolic pressure must be higher than diastolic pressure.";
    }

    if (measurements === 0) {
      errors.general = "Record at least one measurement (temperature, pulse, BP, respiration, SpO₂, sugar, or weight).";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setError("");
    try {
      const created = await patientVitalApi.create(payload);
      setForm(emptyForm());
      setPage(1);
      setRefreshKey((key) => key + 1);
      notify(`${formatDateTime(created.recordedAt)} reading saved.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: PatientVitalRecord) => {
    if (!window.confirm(`Delete the ${formatDateTime(row.recordedAt)} reading?`)) return;
    try {
      await patientVitalApi.remove(row.id);
      setRefreshKey((key) => key + 1);
      notify("Reading deleted.");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const latest = summary?.latest ?? null;
  const latestBp =
    latest && (latest.systolic !== null || latest.diastolic !== null)
      ? `${prettyNumber(latest.systolic) ?? "—"}/${prettyNumber(latest.diastolic) ?? "—"}`
      : "—";
  const filtersActive = Boolean(from || to);

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] cursor-pointer"
      >
        ← Back to Nursing Management
      </button>

      <PatientSearchPicker
        title="Patient Monitoring"
        description="Search a patient to record bedside vitals and review their monitoring history."
        selectedId={patient?.id}
        onPick={pickPatient}
        eyebrow="Nursing Management"
        placeholder="Search patient by name, ID, or phone..."
        refreshToken={refreshKey}
      />

      {patient && (
        <>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-black text-lg text-[var(--primary-dark)]">{patient.name}</h3>
              <p className="text-xs text-[var(--muted)]">
                {patient.patientCode}
                {latest ? ` · Last reading ${formatDateTime(latest.recordedAt)}` : " · No readings recorded yet"}
              </p>
            </div>
            <button
              onClick={() => {
                setPatient(null);
                setRows([]);
                setSummary(null);
                setError("");
              }}
              className="text-xs font-bold text-[var(--primary)] cursor-pointer"
            >
              Choose another
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-4 rounded-2xl border border-[var(--border)] shadow-sm">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <FiActivity className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Readings</span>
              </div>
              <p className="mt-2 text-2xl font-black text-[var(--primary-dark)]">{summary?.total ?? 0}</p>
              <p className="text-[10px] text-[var(--muted)]">Logged for this patient</p>
            </div>
            <div className="card p-4 rounded-2xl border border-[var(--border)] shadow-sm">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <FiAlertTriangle className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Needs attention</span>
              </div>
              <p
                className={`mt-2 text-2xl font-black ${
                  (summary?.abnormalCount ?? 0) > 0 ? "text-rose-500" : "text-emerald-600"
                }`}
              >
                {summary?.abnormalCount ?? 0}
              </p>
              <p className="text-[10px] text-[var(--muted)]">Out-of-range readings</p>
            </div>
            <div className="card p-4 rounded-2xl border border-[var(--border)] shadow-sm">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <FiHeart className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Latest BP</span>
              </div>
              <p className="mt-2 text-2xl font-black text-[var(--primary-dark)]">{latestBp}</p>
              <p className="text-[10px] text-[var(--muted)]">
                {latest?.systolic !== null && latest?.systolic !== undefined ? "mmHg" : "No reading yet"}
              </p>
            </div>
            <div className="card p-4 rounded-2xl border border-[var(--border)] shadow-sm">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <FiActivity className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Latest temp</span>
              </div>
              <p className="mt-2 text-2xl font-black text-[var(--primary-dark)]">
                {latest ? prettyNumber(latest.temperature) ?? "—" : "—"}
              </p>
              <p className="text-[10px] text-[var(--muted)]">
                {latest && latest.temperature !== null ? "°C" : "No reading yet"}
              </p>
            </div>
          </div>

          <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-lg text-[var(--primary-dark)]">Record vitals</h3>
              <p className="text-xs text-[var(--muted)]">
                Enter any of the measurements below — at least one is required.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-3xl">
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Recorded at *
                <input
                  type="datetime-local"
                  value={form.recordedAt}
                  onChange={(e) => setField("recordedAt", e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
                {fieldErrors.recordedAt && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.recordedAt}</p>
                )}
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Recording nurse
                <div className="mt-1">
                  <NursePicker selected={selectedNurse} onPick={setSelectedNurse} />
                </div>
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Temperature (°C)
                <input
                  inputMode="decimal"
                  value={form.temperature}
                  onChange={(e) => setField("temperature", e.target.value)}
                  placeholder="36.8"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
                {fieldErrors.temperature && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.temperature}</p>
                )}
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Pulse (bpm)
                <input
                  inputMode="numeric"
                  value={form.pulse}
                  onChange={(e) => setField("pulse", e.target.value)}
                  placeholder="78"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
                {fieldErrors.pulse && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.pulse}</p>
                )}
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Systolic (mmHg)
                <input
                  inputMode="numeric"
                  value={form.systolic}
                  onChange={(e) => setField("systolic", e.target.value)}
                  placeholder="120"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
                {fieldErrors.systolic && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.systolic}</p>
                )}
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Diastolic (mmHg)
                <input
                  inputMode="numeric"
                  value={form.diastolic}
                  onChange={(e) => setField("diastolic", e.target.value)}
                  placeholder="80"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
                {fieldErrors.diastolic && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.diastolic}</p>
                )}
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Respiration (/min)
                <input
                  inputMode="numeric"
                  value={form.respiratoryRate}
                  onChange={(e) => setField("respiratoryRate", e.target.value)}
                  placeholder="16"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
                {fieldErrors.respiratoryRate && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.respiratoryRate}</p>
                )}
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">
                SpO₂ (%)
                <input
                  inputMode="numeric"
                  value={form.spo2}
                  onChange={(e) => setField("spo2", e.target.value)}
                  placeholder="98"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
                {fieldErrors.spo2 && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.spo2}</p>
                )}
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Blood sugar (mg/dL)
                <input
                  inputMode="decimal"
                  value={form.bloodSugar}
                  onChange={(e) => setField("bloodSugar", e.target.value)}
                  placeholder="110"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
                {fieldErrors.bloodSugar && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.bloodSugar}</p>
                )}
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Weight (kg)
                <input
                  inputMode="decimal"
                  value={form.weight}
                  onChange={(e) => setField("weight", e.target.value)}
                  placeholder="68"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
                {fieldErrors.weight && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.weight}</p>
                )}
              </label>
            </div>

            <label className="block max-w-3xl text-[11px] font-bold text-[var(--muted)]">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Observation, patient response, handover note..."
                className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold resize-y"
              />
            </label>

            {fieldErrors.general && <p className="text-sm alert-error">{fieldErrors.general}</p>}
            {error && <p className="text-sm alert-error">{error}</p>}

            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                style={{ background: "var(--primary)" }}
              >
                {saving ? "Saving…" : "Save reading"}
              </button>
              <button
                onClick={() => {
                  setForm(emptyForm());
                  setFieldErrors({});
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-black text-lg text-[var(--primary-dark)]">Reading history</h3>
                <p className="text-xs text-[var(--muted)]">
                  Most recent first. Highlighted values fall outside the adult reference range.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase">
                  From
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setPage(1);
                    }}
                    className="mt-1 block px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                  />
                </label>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase">
                  To
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setPage(1);
                    }}
                    className="mt-1 block px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                  />
                </label>
                {filtersActive && (
                  <button
                    onClick={() => {
                      setFrom("");
                      setTo("");
                      setPage(1);
                    }}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <p className="text-xs text-[var(--muted)]">Loading readings…</p>
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
                <FiActivity className="w-5 h-5 mx-auto mb-2 text-[var(--muted)] opacity-60" />
                <p className="text-xs font-bold text-[var(--muted)]">
                  {filtersActive
                    ? "No readings match this date range."
                    : "No vitals recorded for this patient yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={`rounded-xl border p-4 ${
                      row.abnormal ? "border-rose-200 bg-rose-50/40" : "border-[var(--border)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <time className="text-xs font-black text-[var(--primary-dark)]">
                          {formatDateTime(row.recordedAt)}
                        </time>
                        {row.abnormal && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 border border-rose-200">
                            <FiAlertTriangle className="w-3 h-3" /> Needs attention
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--muted)]">
                          {row.nurse ? `${row.nurse.name} (${row.nurse.nurseCode})` : row.createdBy?.name ?? "Unassigned"}
                        </span>
                        {row.admission && (
                          <span className="text-[10px] text-[var(--muted)]">· {row.admission.admissionNumber}</span>
                        )}
                      </div>
                      <button
                        onClick={() => remove(row)}
                        title="Delete reading"
                        className="text-rose-500 hover:text-rose-600 cursor-pointer"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {measurementsOf(row).map((measurement) => {
                        const flagged = isFlagged(row, measurement.flagKeys);
                        return (
                          <span
                            key={`${row.id}-${measurement.label}`}
                            className={`inline-flex items-baseline gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                              flagged
                                ? "border-rose-300 bg-rose-100 text-rose-700"
                                : "border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                            }`}
                          >
                            <span className="text-[9px] font-black uppercase tracking-wide text-[var(--muted)]">
                              {measurement.label}
                            </span>
                            <span className="font-black">{measurement.value}</span>
                            <span className="text-[9px] text-[var(--muted)]">{measurement.unit}</span>
                          </span>
                        );
                      })}
                    </div>

                    {row.flags.length > 0 && (
                      <p className="mt-2 text-[10px] font-bold text-rose-500">{row.flags.join(" · ")}</p>
                    )}
                    {row.notes && (
                      <p className="mt-2 text-xs text-[var(--text)] whitespace-pre-wrap">{row.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-[var(--muted)]">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[var(--border)] disabled:opacity-40 cursor-pointer"
                  >
                    <FiChevronLeft className="w-3.5 h-3.5" /> Previous
                  </button>
                  <button
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[var(--border)] disabled:opacity-40 cursor-pointer"
                  >
                    Next <FiChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  );
}
