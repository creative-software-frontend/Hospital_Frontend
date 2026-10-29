// app/patients/PatientVisitHistoryPage.tsx
// "Patient Visit History" sub-feature of the Patient Management module.
// A compact, filterable ledger of every encounter for one patient (OPD,
// follow-up, inpatient, emergency): date, visit number, doctor, linked
// appointment, record counts and status. Read-only — the clinical detail lives
// in "Previous Treatment Records".

"use client";

import { useEffect, useState } from "react";
import {
  FiActivity,
  FiCalendar,
  FiClipboard,
  FiFileText,
  FiHeart,
  FiRefreshCcw,
  FiSearch,
  FiThermometer,
} from "react-icons/fi";
import {
  patientApi,
  calcAge,
  errorMessage,
  formatDate,
  type PatientListRecord,
  type PatientVisitSummary,
  type PatientVisitListResult,
  type PatientVisitRecord,
  type PaginationMeta,
} from "@/app/lib/api";
import { genderLabel } from "@/app/patients/constants";
import { PatientSearchPicker } from "@/app/patients/PatientSearchPicker";

const PAGE_SIZE = 10;

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

const LABEL_CLS =
  "block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1";

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

function visitTypeLabel(value: string | null): string {
  const v = (value ?? "").toUpperCase();
  if (!v) return "Visit";
  return VISIT_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
      <span className="block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)]">
        {label}
      </span>
      <span className="block text-lg font-black text-[var(--text)] leading-tight">{value}</span>
    </div>
  );
}

export function PatientVisitHistoryPage() {
  const [selected, setSelected] = useState<PatientListRecord | null>(null);
  const [result, setResult] = useState<PatientVisitListResult | null>(null);
  const [visits, setVisits] = useState<PatientVisitRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [summary, setSummary] = useState<PatientVisitSummary | null>(null);

  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [visitType, setVisitType] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  // Debounce the free-text filter.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    // Deferred a tick so the effect body never sets state synchronously
    // (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      setLoading(true);
      patientApi
        .visits(selected.id, {
          page,
          limit: PAGE_SIZE,
          from: from || undefined,
          to: to || undefined,
          visitType: visitType || undefined,
          search: term || undefined,
        })
        .then((r) => {
          if (!active) return;
          setResult(r);
          setVisits(r.data);
          setPagination(r.pagination);
          setSummary(r.summary);
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
  }, [selected, page, from, to, visitType, term, reload]);

  const pick = (patient: PatientListRecord) => {
    setSelected(patient);
    setResult(null);
    setVisits([]);
    setPagination(null);
    setSummary(null);
    setPage(1);
    setFrom("");
    setTo("");
    setVisitType("");
    setSearch("");
    setTerm("");
    setError("");
  };

  const clearFilters = () => {
    setFrom("");
    setTo("");
    setVisitType("");
    setSearch("");
    setTerm("");
    setPage(1);
  };

  const filtersActive = Boolean(from || to || visitType || term);
  const totalPages = pagination?.totalPages ?? 0;
  const patient = result?.patient ?? null;

  // Whole-history tiles (they ignore the filters on purpose).
  const opd = summary?.byType.OPD ?? 0;
  const ipd = summary?.byType.IPD ?? 0;
  const emergency = summary?.byType.EMERGENCY ?? 0;

  return (
    <div className="space-y-4">
      <PatientSearchPicker
        title="Patient Visit History"
        description="Search a patient to browse every encounter in one filterable ledger."
        selectedId={selected?.id ?? null}
        onPick={pick}
      />

      {selected && (
        <div className="card p-6 rounded-2xl shadow-sm space-y-5 w-full">
          {/* Patient header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] flex items-center justify-center shrink-0">
                <FiActivity className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-lg text-[var(--text)]">
                  {patient?.name ?? selected.name}
                </h4>
                <p className="text-[11px] text-[var(--muted)] font-semibold">
                  {[
                    patient?.patientCode ?? selected.patientCode,
                    genderLabel(patient?.gender ?? selected.gender),
                    calcAge(patient?.dateOfBirth ?? selected.dateOfBirth),
                    patient?.phone ?? selected.phone,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-[10px] text-[var(--muted)] font-semibold mt-0.5">
                  {[
                    summary?.lastVisitAt
                      ? `Last visit ${formatDate(summary.lastVisitAt)}`
                      : "No visits recorded",
                    summary ? `${summary.doctorCount} doctor${summary.doctorCount === 1 ? "" : "s"} seen` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setReload((t) => t + 1)}
              title="Refresh visits"
              className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              <FiRefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Whole-history tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatTile label="Total visits" value={summary?.total ?? 0} />
            <StatTile label="OPD" value={opd} />
            <StatTile label="Inpatient" value={ipd} />
            <StatTile label="Emergency" value={emergency} />
          </div>

          {/* Filter bar */}
          <div className="grid grid-cols-1 sm:grid-cols-[9rem_9rem_9rem_minmax(0,24rem)] gap-3">
            <div>
              <label htmlFor="pv-from" className={LABEL_CLS}>
                From
              </label>
              <input
                id="pv-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className={`${INPUT_CLS} h-[34px]`}
              />
            </div>
            <div>
              <label htmlFor="pv-to" className={LABEL_CLS}>
                To
              </label>
              <input
                id="pv-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className={`${INPUT_CLS} h-[34px]`}
              />
            </div>
            <div>
              <label htmlFor="pv-type" className={LABEL_CLS}>
                Visit type
              </label>
              <select
                id="pv-type"
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
            <div>
              <label htmlFor="pv-search" className={LABEL_CLS}>
                Search
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]" />
                  <input
                    id="pv-search"
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Visit no, doctor, complaint or diagnosis..."
                    className={`${INPUT_CLS} pl-9`}
                  />
                </div>
                {filtersActive && (
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="alert-error text-xs flex items-center justify-between">
              {error}
              <button
                onClick={() => setReload((t) => t + 1)}
                className="text-xs font-bold underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Ledger */}
          {loading && visits.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
              <p className="text-xs font-bold text-[var(--muted)] mt-3">Loading visits…</p>
            </div>
          ) : visits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
              <FiFileText className="w-6 h-6 mx-auto mb-2 text-[var(--muted)] opacity-50" />
              <p className="text-xs font-bold text-[var(--muted)]">
                {filtersActive
                  ? "No visits match these filters."
                  : "This patient has no recorded visits yet."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-[var(--bg)] border-b border-[var(--border)] text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)]">
                <span className="w-24 shrink-0">Date</span>
                <span className="flex-1">Visit · doctor</span>
                <span className="w-28 shrink-0 text-right">Records</span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {visits.map((visit) => {
                  const typeKey = (visit.visitType ?? "").toUpperCase();
                  return (
                    <div
                      key={visit.id}
                      className="flex items-start justify-between gap-3 px-4 py-3 flex-wrap hover:bg-[var(--primary-soft)]/10 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-24 shrink-0">
                          <span className="flex items-center gap-1.5 text-[11px] font-black text-[var(--text)]">
                            <FiCalendar className="w-3 h-3 text-[var(--muted)]" />
                            {formatDate(visit.createdAt)}
                          </span>
                          <span className="block text-[10px] text-[var(--muted)] font-semibold pl-[18px]">
                            {timeOf(visit.createdAt)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-[var(--text)]">
                              {visit.visitNumber}
                            </span>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${
                                VISIT_TYPE_BADGE[typeKey] ??
                                "bg-slate-500/15 text-slate-500 border-slate-400/30"
                              }`}
                            >
                              {visitTypeLabel(visit.visitType)}
                            </span>
                            {visit.status !== "active" && (
                              <span className="text-[9px] font-bold text-[var(--muted)] border border-[var(--border)] rounded-full px-2 py-0.5">
                                {visit.status}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[var(--muted)] font-semibold mt-0.5">
                            {[visit.doctor?.name, visit.doctor?.specialization]
                              .filter(Boolean)
                              .join(" · ") || "No doctor recorded"}
                            {visit.appointment?.appointmentNumber && (
                              <span className="ml-1">· Appt {visit.appointment.appointmentNumber}</span>
                            )}
                          </p>
                          {visit.chiefComplaint && (
                            <p className="text-[10px] text-[var(--muted)] mt-0.5 line-clamp-2">
                              {visit.chiefComplaint}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--muted)]">
                          <FiClipboard className="w-3 h-3" title="Diagnoses" />
                          {visit._count.diagnoses}
                          <FiHeart className="w-3 h-3 ml-1" title="Prescriptions" />
                          {visit._count.prescriptions}
                          <FiThermometer className="w-3 h-3 ml-1" title="Lab orders" />
                          {visit._count.labOrders}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[11px] font-bold text-[var(--muted)]">
                Page {pagination?.page} of {totalPages} · {pagination?.total} visit
                {(pagination?.total ?? 0) === 1 ? "" : "s"}
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
