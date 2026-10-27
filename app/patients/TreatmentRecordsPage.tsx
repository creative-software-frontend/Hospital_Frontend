// app/patients/TreatmentRecordsPage.tsx
// "Previous Treatment Records" sub-feature of the Patient Management module.
// Pick a patient, then browse every past consultation as an expandable record:
// diagnoses, vitals, clinical notes, prescribed medicines and lab tests.
// Read-only — clinical records are written by the doctors' workflow.

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiChevronDown,
  FiClipboard,
  FiFileText,
  FiHeart,
  FiRefreshCcw,
  FiSearch,
  FiStar,
  FiThermometer,
} from "react-icons/fi";
import {
  patientApi,
  calcAge,
  errorMessage,
  formatDate,
  type PatientHistorySummary,
  type PatientListRecord,
  type PaginationMeta,
  type TreatmentRecord,
  type TreatmentRecordPrescription,
} from "@/app/lib/api";
import { bloodGroupLabel, genderLabel } from "@/app/patients/constants";
import { PatientSearchPicker } from "@/app/patients/PatientSearchPicker";

const PAGE_SIZE = 5;

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

const VISIT_TYPE_OPTIONS = [
  { value: "", label: "All visit types" },
  { value: "OPD", label: "OPD" },
  { value: "FOLLOWUP", label: "Follow-up" },
  { value: "IPD", label: "Inpatient (IPD)" },
  { value: "EMERGENCY", label: "Emergency" },
];

const VISIT_TYPE_BADGE: Record<string, string> = {
  OPD: "bg-emerald-500/15 text-emerald-600 border-emerald-400/30",
  FOLLOWUP: "bg-sky-500/15 text-sky-600 border-sky-400/30",
  IPD: "bg-violet-500/15 text-violet-600 border-violet-400/30",
  EMERGENCY: "bg-rose-500/15 text-rose-500 border-rose-400/30",
};

const LAB_STATUS_BADGE: Record<string, string> = {
  ordered: "bg-sky-500/15 text-sky-600 border-sky-400/30",
  sampled: "bg-amber-500/15 text-amber-600 border-amber-400/30",
  "in-progress": "bg-violet-500/15 text-violet-600 border-violet-400/30",
  completed: "bg-emerald-500/15 text-emerald-600 border-emerald-400/30",
  cancelled: "bg-slate-500/15 text-slate-500 border-slate-400/30",
};

function visitTypeLabel(value: string | null): string {
  const v = (value ?? "").toUpperCase();
  if (!v) return "Visit";
  return VISIT_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

/** `{ bp: "120/80", pulse: 78 }` → readable pairs. */
function vitalEntries(vitals: Record<string, unknown> | null): { label: string; value: string }[] {
  if (!vitals) return [];
  return Object.entries(vitals)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => ({
      label: k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      value: typeof v === "object" ? JSON.stringify(v) : String(v),
    }));
}

function PrescriptionBlock({ prescription }: { prescription: TreatmentRecordPrescription }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[var(--border)]">
        <span className="text-[11px] font-black text-[var(--text)]">
          Prescription <span className="text-[var(--muted)] font-bold">{prescription.prescriptionNumber}</span>
        </span>
        <span className="text-[10px] font-bold text-[var(--muted)]">
          {prescription.items.length} medicine{prescription.items.length === 1 ? "" : "s"} · {formatDate(prescription.createdAt)}
        </span>
      </div>
      {prescription.notes && (
        <p className="px-3 pt-2 text-[11px] text-[var(--muted)] font-semibold">{prescription.notes}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-widest text-[var(--muted)] font-extrabold">
              {["Medicine", "Dosage", "Frequency", "Duration", "Route", "Qty", "Instruction"].map((h) => (
                <th key={h} className="px-3 py-1.5 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {prescription.items.map((item) => (
              <tr key={item.id} className="text-[11px]">
                <td className="px-3 py-1.5">
                  <span className="block font-bold text-[var(--text)]">
                    {item.medicine?.brandName ?? item.medicine?.genericName ?? "-"}
                  </span>
                  <span className="block text-[10px] text-[var(--muted)]">
                    {[
                      item.medicine?.genericName,
                      item.medicine?.unit?.shortName ?? item.medicine?.unit?.name,
                      item.medicine?.medicineCode,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-[var(--text)]">{item.dosage ?? "-"}</td>
                <td className="px-3 py-1.5 text-[var(--text)]">{item.frequency ?? "-"}</td>
                <td className="px-3 py-1.5 text-[var(--text)]">{item.duration ?? "-"}</td>
                <td className="px-3 py-1.5 text-[var(--text)]">{item.route ?? "-"}</td>
                <td className="px-3 py-1.5 text-[var(--text)]">{item.quantity ?? "-"}</td>
                <td className="px-3 py-1.5 text-[var(--muted)]">{item.instruction ?? "-"}</td>
              </tr>
            ))}
            {prescription.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-3 text-center text-[11px] font-bold text-[var(--muted)]">
                  No medicines recorded on this prescription.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordCard({ record }: { record: TreatmentRecord }) {
  const [open, setOpen] = useState(false);
  const vitals = useMemo(() => vitalEntries(record.vitals), [record.vitals]);
  const medicineCount = record.prescriptions.reduce((n, p) => n + p.items.length, 0);
  const labCount = record.labOrders.reduce((n, o) => n + o.items.length, 0);
  const typeKey = (record.visitType ?? "").toUpperCase();

  const clinical: { label: string; value: string }[] = [
    { label: "Chief complaint", value: record.chiefComplaint ?? "" },
    { label: "History", value: record.history ?? "" },
    { label: "Examination", value: record.examination ?? "" },
    { label: "Notes", value: record.notes ?? "" },
  ].filter((row) => row.value);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left cursor-pointer hover:bg-[var(--primary-soft)]/10 transition-colors"
      >
        <span className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] flex items-center justify-center shrink-0">
            <FiClipboard className="w-4 h-4" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-[var(--text)]">{formatDate(record.createdAt)}</span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${
                  VISIT_TYPE_BADGE[typeKey] ?? "bg-slate-500/15 text-slate-500 border-slate-400/30"
                }`}
              >
                {visitTypeLabel(record.visitType)}
              </span>
              {record.status !== "active" && (
                <span className="text-[10px] font-bold text-[var(--muted)] border border-[var(--border)] rounded-full px-2 py-0.5">
                  {record.status}
                </span>
              )}
            </span>
            <span className="block text-[10px] text-[var(--muted)] font-semibold mt-0.5">
              {[record.visitNumber, record.doctor?.name, record.appointment?.appointmentNumber]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0 mt-1">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)]">
            <FiClipboard className="w-3 h-3" />
            {record.diagnoses.length}
            <FiHeart className="w-3 h-3 ml-1" />
            {medicineCount}
            <FiThermometer className="w-3 h-3 ml-1" />
            {labCount}
          </span>
          <FiChevronDown
            className={`w-4 h-4 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-4 py-4 space-y-4">
          {/* Diagnoses + vitals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)] mb-1.5">
                Diagnoses
              </p>
              {record.diagnoses.length === 0 ? (
                <p className="text-[11px] font-semibold text-[var(--muted)]">No diagnosis recorded.</p>
              ) : (
                <div className="space-y-1.5">
                  {record.diagnoses.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-start gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5"
                    >
                      {d.isPrimary && (
                        <FiStar className="w-3 h-3 mt-0.5 text-amber-500 shrink-0" title="Primary diagnosis" />
                      )}
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-[var(--text)]">
                          {d.diagnosis?.name ?? "-"}
                        </span>
                        <span className="block text-[10px] text-[var(--muted)]">
                          {[
                            d.diagnosis?.code,
                            d.diagnosis?.category?.name,
                            d.notes,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)] mb-1.5">
                Vitals
              </p>
              {vitals.length === 0 ? (
                <p className="text-[11px] font-semibold text-[var(--muted)]">No vitals recorded.</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {vitals.map((v) => (
                    <div
                      key={v.label}
                      className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5"
                    >
                      <span className="block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)]">
                        {v.label}
                      </span>
                      <span className="block text-[11px] font-bold text-[var(--text)] truncate">{v.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Clinical text */}
          {clinical.length > 0 && (
            <div>
              <p className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)] mb-1.5">
                Clinical notes
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {clinical.map((row) => (
                  <div key={row.label} className="text-[11px]">
                    <dt className="font-bold text-[var(--muted)]">{row.label}</dt>
                    <dd className="text-[var(--text)] whitespace-pre-line">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Prescriptions */}
          <div>
            <p className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)] mb-1.5">
              Prescribed medicines
            </p>
            {record.prescriptions.length === 0 ? (
              <p className="text-[11px] font-semibold text-[var(--muted)]">No prescription issued.</p>
            ) : (
              <div className="space-y-2">
                {record.prescriptions.map((p) => (
                  <PrescriptionBlock key={p.id} prescription={p} />
                ))}
              </div>
            )}
          </div>

          {/* Lab tests */}
          <div>
            <p className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)] mb-1.5">
              Lab tests
            </p>
            {record.labOrders.length === 0 ? (
              <p className="text-[11px] font-semibold text-[var(--muted)]">No lab tests ordered.</p>
            ) : (
              <div className="space-y-2">
                {record.labOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[var(--border)]">
                      <span className="text-[11px] font-black text-[var(--text)]">
                        Order <span className="text-[var(--muted)] font-bold">{order.orderNumber}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {order.priority && (
                          <span className="text-[10px] font-bold text-[var(--muted)]">{order.priority}</span>
                        )}
                        <span
                          className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${
                            LAB_STATUS_BADGE[order.status] ?? "bg-slate-500/15 text-slate-500 border-slate-400/30"
                          }`}
                        >
                          {order.status}
                        </span>
                      </span>
                    </div>
                    <ul className="divide-y divide-[var(--border)]">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                          <span className="min-w-0">
                            <span className="block text-[11px] font-bold text-[var(--text)] truncate">
                              {item.labTest?.testName ?? "-"}
                            </span>
                            <span className="block text-[10px] text-[var(--muted)]">
                              {[item.labTest?.testCode, item.labTest?.sampleType].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="text-[10px] font-bold text-[var(--muted)] shrink-0">{item.status}</span>
                        </li>
                      ))}
                      {order.items.length === 0 && (
                        <li className="px-3 py-2 text-center text-[11px] font-bold text-[var(--muted)]">
                          No tests on this order.
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TreatmentRecordsPage() {
  const [selected, setSelected] = useState<PatientListRecord | null>(null);
  const [patient, setPatient] = useState<PatientHistorySummary | null>(null);
  const [records, setRecords] = useState<TreatmentRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [visitType, setVisitType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  // Debounce the record search.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      patientApi
        .treatmentRecords(selected.id, {
          page,
          limit: PAGE_SIZE,
          search: term || undefined,
          visitType: visitType || undefined,
        })
        .then((r) => {
          if (!active) return;
          setRecords(r.data);
          setPagination(r.pagination);
          setPatient(r.patient);
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
  }, [selected, page, term, visitType, reload]);

  const pick = (p: PatientListRecord) => {
    setSelected(p);
    setPatient(null);
    setRecords([]);
    setPagination(null);
    setPage(1);
    setSearch("");
    setTerm("");
    setVisitType("");
    setError("");
  };

  const totalPages = pagination?.totalPages ?? 0;
  const totalRecords = pagination?.total ?? 0;

  return (
    <div className="space-y-4">
      <PatientSearchPicker
        title="Previous Treatment Records"
        description="Search a patient to review every past consultation with its diagnosis, medicines, lab tests and vitals."
        selectedId={selected?.id ?? null}
        onPick={pick}
      />

      {selected && (
        <div className="card p-6 rounded-2xl shadow-sm space-y-5 w-full">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] flex items-center justify-center shrink-0">
                <FiActivity className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-lg text-[var(--text)]">{patient?.name ?? selected.name}</h4>
                <p className="text-[11px] text-[var(--muted)] font-semibold">
                  {[
                    patient?.patientCode ?? selected.patientCode,
                    genderLabel(patient?.gender ?? selected.gender),
                    calcAge(patient?.dateOfBirth ?? selected.dateOfBirth),
                    bloodGroupLabel(patient?.bloodGroup ?? selected.bloodGroup),
                    patient?.phone ?? selected.phone,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
                {totalRecords} record{totalRecords === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => setReload((t) => t + 1)}
                title="Refresh records"
                className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                <FiRefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-3">
            <div>
              <label
                htmlFor="tr-filter-search"
                className="block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1"
              >
                Search records
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]" />
                <input
                  id="tr-filter-search"
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Complaint, diagnosis, doctor or visit no..."
                  className={`${INPUT_CLS} pl-9`}
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="tr-filter-type"
                className="block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1"
              >
                Visit type
              </label>
              <select
                id="tr-filter-type"
                value={visitType}
                onChange={(e) => {
                  setVisitType(e.target.value);
                  setPage(1);
                }}
                className={`${INPUT_CLS} h-[34px]`}
              >
                {VISIT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="alert-error text-xs flex items-center justify-between">
              {error}
              <button onClick={() => setReload((t) => t + 1)} className="text-xs font-bold underline cursor-pointer">
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
              <p className="text-xs font-bold text-[var(--muted)] mt-3">Loading records…</p>
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
              <FiFileText className="w-6 h-6 mx-auto mb-2 text-[var(--muted)] opacity-50" />
              <p className="text-xs font-bold text-[var(--muted)]">
                {term || visitType
                  ? "No treatment records match these filters."
                  : "This patient has no treatment records yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((record) => (
                <RecordCard key={record.id} record={record} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[11px] font-bold text-[var(--muted)]">
                Page {pagination?.page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
