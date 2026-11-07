// app/nurses/MedicationTrackingPage.tsx
// Nursing Management → Medication Tracking: per-patient dose log. A nurse picks
// a patient, sees the medicines from their active prescriptions and logs each
// dose as Given / Held / Refused / Missed with time, nurse and notes.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiHeart, FiTrash2, FiXCircle } from "react-icons/fi";
import {
  errorMessage,
  medicationAdministrationApi,
  type CreateMedicationAdministrationInput,
  type MedicationAdministrationPrescribedMedicine,
  type MedicationAdministrationRecord,
  type MedicationAdministrationStatusValue,
  type MedicationAdministrationSummary,
  type NurseRecord,
  type PatientListRecord,
} from "@/app/lib/api";
import { PatientSearchPicker } from "@/app/patients/PatientSearchPicker";
import { ToastViewport, type ToastItem } from "@/app/patients/Toast";
import { NursePicker } from "@/app/nurses/NursePicker";

const PAGE_SIZE = 10;

const STATUSES: MedicationAdministrationStatusValue[] = ["GIVEN", "HELD", "REFUSED", "MISSED"];

const STATUS_STYLES: Record<MedicationAdministrationStatusValue, string> = {
  GIVEN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  HELD: "bg-amber-50 text-amber-700 border-amber-200",
  REFUSED: "bg-rose-50 text-rose-700 border-rose-200",
  MISSED: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_LABELS: Record<MedicationAdministrationStatusValue, string> = {
  GIVEN: "Given",
  HELD: "Held",
  REFUSED: "Refused",
  MISSED: "Missed",
};

const nowInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const isFuture = (value: string) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now() + 60_000;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

type MedFormState = {
  medicineName: string;
  dosage: string;
  route: string;
  status: MedicationAdministrationStatusValue;
  administeredAt: string;
  notes: string;
};

const emptyForm = (): MedFormState => ({
  medicineName: "",
  dosage: "",
  route: "",
  status: "GIVEN",
  administeredAt: nowInput(),
  notes: "",
});

export function MedicationTrackingPage({ onBack }: { onBack: () => void }) {
  const [patient, setPatient] = useState<PatientListRecord | null>(null);
  const [rows, setRows] = useState<MedicationAdministrationRecord[]>([]);
  const [summary, setSummary] = useState<MedicationAdministrationSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [meds, setMeds] = useState<MedicationAdministrationPrescribedMedicine[]>([]);
  const [medsLoading, setMedsLoading] = useState(false);
  const [prescribedItemId, setPrescribedItemId] = useState("");

  const [form, setForm] = useState<MedFormState>(emptyForm);
  const [selectedNurse, setSelectedNurse] = useState<NurseRecord | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((message: string, kind: ToastItem["kind"] = "success") => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current.slice(-3), { id, kind, message }]);
  }, []);

  // Load the selected patient's medication administrations (deferred a tick so
  // the effect body never calls setState synchronously).
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
      medicationAdministrationApi
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

  // Load the prescribed medicines for the selected patient.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!patient) {
        setMeds([]);
        setPrescribedItemId("");
        setMedsLoading(false);
        return;
      }
      setMedsLoading(true);
      medicationAdministrationApi
        .prescribed(patient.id)
        .then((result) => {
          if (!active) return;
          setMeds(result.data);
          setPrescribedItemId("");
        })
        .catch(() => {
          if (active) setMeds([]);
        })
        .finally(() => {
          if (active) setMedsLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [patient, refreshKey]);

  const pickPatient = (next: PatientListRecord) => {
    setPatient(next);
    setRows([]);
    setSummary(null);
    setPage(1);
    setFrom("");
    setTo("");
    setForm(emptyForm());
    setPrescribedItemId("");
    setMeds([]);
    setFieldErrors({});
    setError("");
  };

  const setField = (key: keyof MedFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key !== "notes") setFieldErrors((current) => ({ ...current, general: undefined }));
  };

  const pickPrescribed = (itemId: string) => {
    setPrescribedItemId(itemId);
    const item = meds.find((m) => String(m.itemId) === itemId) ?? null;
    if (item) {
      setForm((current) => ({
        ...current,
        medicineName: item.medicineName,
        dosage: item.dosage ?? current.dosage,
        route: item.route ?? current.route,
      }));
    }
  };

  const save = async () => {
    if (!patient) return;
    const errors: Record<string, string> = {};

    if (!form.medicineName.trim()) errors.medicineName = "Medicine is required.";
    if (!form.administeredAt) errors.administeredAt = "Administered at is required.";
    else if (isFuture(form.administeredAt)) errors.administeredAt = "Administered at cannot be in the future.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payload: CreateMedicationAdministrationInput = {
      patientId: patient.id,
      prescriptionItemId: prescribedItemId ? Number(prescribedItemId) : null,
      medicineName: form.medicineName.trim(),
      dosage: form.dosage.trim() || null,
      route: form.route.trim() || null,
      status: form.status,
      administeredAt: new Date(form.administeredAt).toISOString(),
      notes: form.notes.trim() || null,
      nurseId: selectedNurse?.id ?? null,
    };

    setSaving(true);
    setFieldErrors({});
    setError("");
    try {
      const created = await medicationAdministrationApi.create(payload);
      setForm(emptyForm());
      setPrescribedItemId("");
      setPage(1);
      setRefreshKey((key) => key + 1);
      notify(`${STATUS_LABELS[created.status]} recorded for ${created.medicineName}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: MedicationAdministrationRecord) => {
    if (!window.confirm(`Delete the ${formatDateTime(row.administeredAt)} "${row.medicineName}" administration?`)) return;
    try {
      await medicationAdministrationApi.remove(row.id);
      setRefreshKey((key) => key + 1);
      notify("Medication administration deleted.");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const last = summary?.lastGivenAt ? formatDateTime(summary.lastGivenAt) : null;
  const attentionCount = summary ? summary.held + summary.refused + summary.missed : 0;
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
        title="Medication Tracking"
        description="Search a patient to review their prescribed medicines and log doses."
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
                {summary?.lastGivenAt ? ` · Last dose ${formatDateTime(summary.lastGivenAt)}` : " · No doses recorded yet"}
              </p>
            </div>
            <button
              onClick={() => {
                setPatient(null);
                setRows([]);
                setSummary(null);
                setMeds([]);
                setForm(emptyForm());
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
                <span className="text-[10px] font-black uppercase tracking-widest">Doses logged</span>
              </div>
              <p className="mt-2 text-2xl font-black text-[var(--primary-dark)]">{summary?.total ?? 0}</p>
              <p className="text-[10px] text-[var(--muted)]">Administrations for this patient</p>
            </div>
            <div className="card p-4 rounded-2xl border border-[var(--border)] shadow-sm">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <FiCheckCircle className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Given</span>
              </div>
              <p className="mt-2 text-2xl font-black text-[var(--primary-dark)]">{summary?.given ?? 0}</p>
              <p className="text-[10px] text-[var(--muted)]">Doses marked given</p>
            </div>
            <div className="card p-4 rounded-2xl border border-[var(--border)] shadow-sm">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <FiAlertTriangle className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Needs attention</span>
              </div>
              <p className={`mt-2 text-2xl font-black ${attentionCount > 0 ? "text-rose-500" : "text-emerald-600"}`}>
                {attentionCount}
              </p>
              <p className="text-[10px] text-[var(--muted)]">Held · Refused · Missed</p>
            </div>
            <div className="card p-4 rounded-2xl border border-[var(--border)] shadow-sm">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <FiHeart className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Last dose</span>
              </div>
              <p className="mt-2 text-2xl font-black text-[var(--primary-dark)]">{last ?? "—"}</p>
              <p className="text-[10px] text-[var(--muted)]">
                {last ? formatDateTime(summary?.lastGivenAt ?? "") : "No doses yet"}
              </p>
            </div>
          </div>

          <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-lg text-[var(--primary-dark)]">Log medication dose</h3>
              <p className="text-xs text-[var(--muted)]">
                Record what was given (or held / refused / missed) for a prescribed medicine.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-3xl">
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Medicine *
                <input
                  value={form.medicineName}
                  onChange={(e) => setField("medicineName", e.target.value)}
                  placeholder="e.g. Paracetamol 500mg"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
                {fieldErrors.medicineName && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.medicineName}</p>
                )}
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Dosage
                <input
                  value={form.dosage}
                  onChange={(e) => setField("dosage", e.target.value)}
                  placeholder="500mg"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Route
                <input
                  value={form.route}
                  onChange={(e) => setField("route", e.target.value)}
                  placeholder="Oral / IV / IM"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Status
                <select
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value as MedicationAdministrationStatusValue)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)] sm:col-span-2">
                Administered at *
                <input
                  type="datetime-local"
                  value={form.administeredAt}
                  onChange={(e) => setField("administeredAt", e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold"
                />
                {fieldErrors.administeredAt && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.administeredAt}</p>
                )}
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)] sm:col-span-2">
                Recording nurse
                <div className="mt-1">
                  <NursePicker selected={selectedNurse} onPick={setSelectedNurse} />
                </div>
              </label>
            </div>

            <div className="max-w-3xl">
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Linked prescription item (optional)
                <select
                  value={prescribedItemId}
                  onChange={(e) => pickPrescribed(e.target.value)}
                  disabled={medsLoading}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold disabled:opacity-60"
                >
                  <option value="">— Manual entry —</option>
                  {meds.map((m) => (
                    <option key={m.itemId} value={String(m.itemId)}>
                      {m.medicineName}
                      {m.dosage ? ` · ${m.dosage}` : ""}
                      {m.frequency ? ` · ${m.frequency}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {prescribedItemId ? (
              <p className="text-[11px] font-bold text-[var(--muted)]">
                Linked to prescription item <span className="text-[var(--text)]">{prescribedItemId}</span> — medicine,
                dosage and route are taken from the prescription.
              </p>
            ) : (
              <p className="text-[11px] text-[var(--muted)]">
                Not linked to a prescription item — the values are stored as entered.
              </p>
            )}

            <label className="block max-w-3xl text-[11px] font-bold text-[var(--muted)]">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Dose given, patient response, refused reason..."
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
                {saving ? "Saving…" : "Save dose"}
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
                <h3 className="font-black text-lg text-[var(--primary-dark)]">Medication history</h3>
                <p className="text-xs text-[var(--muted)]">
                  Most recent first. Held / Refused / Missed need attention.
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
              <p className="text-xs text-[var(--muted)]">Loading administrations…</p>
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
                <FiActivity className="w-5 h-5 mx-auto mb-2 text-[var(--muted)] opacity-60" />
                <p className="text-xs font-bold text-[var(--muted)]">
                  {filtersActive ? "No administrations match this date range." : "No medication doses recorded for this patient yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={`rounded-xl border p-4 ${
                      row.status === "GIVEN" ? "border-[var(--border)]" : "border-amber-200 bg-amber-50/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black text-[var(--primary-dark)]">{formatDateTime(row.administeredAt)}</span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[row.status]}`}
                        >
                          {row.status === "GIVEN" ? (
                            <FiCheckCircle className="w-3 h-3" />
                          ) : row.status === "HELD" ? (
                            <FiClock className="w-3 h-3" />
                          ) : row.status === "REFUSED" ? (
                            <FiXCircle className="w-3 h-3" />
                          ) : (
                            <FiAlertTriangle className="w-3 h-3" />
                          )}
                          {STATUS_LABELS[row.status]}
                        </span>
                      </div>
                      <button
                        onClick={() => remove(row)}
                        title="Delete administration"
                        className="text-rose-500 hover:text-rose-600 cursor-pointer"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="mt-2 text-xs font-bold text-[var(--text)]">
                      {row.medicineName}
                      {row.dosage ? <span className="text-[var(--muted)]"> · {row.dosage}</span> : null}
                      {row.route ? <span className="text-[var(--muted)]"> · {row.route}</span> : null}
                    </p>

                    <p className="mt-1 text-[10px] text-[var(--muted)]">
                      {row.nurse ? `${row.nurse.name} (${row.nurse.nurseCode})` : row.createdBy?.name ?? "Unassigned"}
                      {row.admission ? ` · ${row.admission.admissionNumber}` : ""}
                    </p>

                    {row.notes && <p className="mt-2 text-xs text-[var(--text)] whitespace-pre-wrap">{row.notes}</p>}
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-[var(--muted)]">Page {page} of {totalPages}</span>
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
