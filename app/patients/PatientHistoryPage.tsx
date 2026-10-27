// app/patients/PatientHistoryPage.tsx
// "Patient History Tracking" sub-feature of the Patient Management module.
// Pick a patient, then read their whole clinical timeline in one place:
// outpatient appointments, consultation visits and inpatient admissions,
// merged newest-first. Read-only — nothing here mutates data.

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiCalendar,
  FiClipboard,
  FiFileText,
  FiHome,
} from "react-icons/fi";
import {
  patientApi,
  calcAge,
  errorMessage,
  formatDate,
  type AdmissionStatus,
  type AppointmentStatus,
  type PatientHistoryAppointment,
  type PatientHistoryResult,
  type PatientHistoryVisit,
  type PatientListRecord,
} from "@/app/lib/api";
import { bloodGroupLabel, genderLabel } from "@/app/patients/constants";
import { PatientSearchPicker } from "@/app/patients/PatientSearchPicker";

/* ------------------------------------------------------------------ */
/* Presentation maps                                                   */
/* ------------------------------------------------------------------ */

const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; badge: string }> = {
  SCHEDULED: { label: "Scheduled", badge: "bg-sky-500/15 text-sky-600 border-sky-400/30" },
  CHECKED_IN: { label: "Checked in", badge: "bg-amber-500/15 text-amber-600 border-amber-400/30" },
  IN_CONSULTATION: {
    label: "In consultation",
    badge: "bg-violet-500/15 text-violet-600 border-violet-400/30",
  },
  COMPLETED: { label: "Completed", badge: "bg-emerald-500/15 text-emerald-600 border-emerald-400/30" },
  CANCELLED: { label: "Cancelled", badge: "bg-rose-500/15 text-rose-500 border-rose-400/30" },
  NO_SHOW: { label: "No show", badge: "bg-slate-500/15 text-slate-500 border-slate-400/30" },
};

const ADMISSION_STATUS: Record<AdmissionStatus, { label: string; badge: string }> = {
  ADMITTED: { label: "Admitted", badge: "bg-violet-500/15 text-violet-600 border-violet-400/30" },
  TRANSFERRED: { label: "Transferred", badge: "bg-amber-500/15 text-amber-600 border-amber-400/30" },
  DISCHARGED: { label: "Discharged", badge: "bg-emerald-500/15 text-emerald-600 border-emerald-400/30" },
  CANCELLED: { label: "Cancelled", badge: "bg-rose-500/15 text-rose-500 border-rose-400/30" },
};

/** Consultation visits store `visitType`/`status` as free text. */
function visitBadge(visit: PatientHistoryVisit): { label: string; badge: string } {
  const type = (visit.visitType ?? "").toUpperCase();
  if (type === "FOLLOWUP") return { label: "Follow-up", badge: "bg-sky-500/15 text-sky-600 border-sky-400/30" };
  if (type === "IPD") return { label: "Inpatient", badge: "bg-violet-500/15 text-violet-600 border-violet-400/30" };
  if (type === "EMERGENCY") return { label: "Emergency", badge: "bg-rose-500/15 text-rose-500 border-rose-400/30" };
  if (visit.status && visit.status !== "active") {
    return { label: visit.status, badge: "bg-slate-500/15 text-slate-500 border-slate-400/30" };
  }
  return { label: "OPD", badge: "bg-emerald-500/15 text-emerald-600 border-emerald-400/30" };
}

/* ------------------------------------------------------------------ */
/* Timeline model                                                      */
/* ------------------------------------------------------------------ */

type TimelineKind = "appointment" | "visit" | "admission";
type Filter = "all" | TimelineKind;

interface TimelineEntry {
  key: string;
  kind: TimelineKind;
  /** ISO timestamp used for the newest-first sort. */
  at: string;
  title: string;
  reference: string;
  doctor: string | null;
  status: { label: string; badge: string };
  details: { label: string; value: string }[];
}

const KIND_META: Record<
  TimelineKind,
  { icon: typeof FiCalendar; label: string; chip: string; dot: string }
> = {
  appointment: {
    icon: FiCalendar,
    label: "Appointment",
    chip: "bg-sky-500/10 text-sky-600 border-sky-400/30",
    dot: "bg-sky-500/15 text-sky-600",
  },
  visit: {
    icon: FiClipboard,
    label: "Consultation",
    chip: "bg-emerald-500/10 text-emerald-600 border-emerald-400/30",
    dot: "bg-emerald-500/15 text-emerald-600",
  },
  admission: {
    icon: FiHome,
    label: "Admission",
    chip: "bg-violet-500/10 text-violet-600 border-violet-400/30",
    dot: "bg-violet-500/15 text-violet-600",
  },
};

function doctorName(doctor: { name: string } | null | undefined): string | null {
  return doctor?.name ?? null;
}

function appointmentEntry(a: PatientHistoryAppointment): TimelineEntry {
  const details: { label: string; value: string }[] = [];
  if (a.shift) details.push({ label: "Shift", value: a.shift });
  if (a.reason) details.push({ label: "Reason", value: a.reason });
  if (a.doctorFee) details.push({ label: "Fee", value: a.doctorFee });
  if (a.paymentMode) details.push({ label: "Payment", value: a.paymentMode });
  return {
    key: `appointment-${a.id}`,
    kind: "appointment",
    at: a.appointmentDate,
    title: `${formatDate(a.appointmentDate)} · ${a.startTime}–${a.endTime}`,
    reference: a.appointmentNumber,
    doctor: doctorName(a.doctor),
    status: APPOINTMENT_STATUS[a.status] ?? { label: a.status, badge: "bg-slate-500/15 text-slate-500 border-slate-400/30" },
    details,
  };
}

function visitEntry(v: PatientHistoryVisit): TimelineEntry {
  const details: { label: string; value: string }[] = [];
  if (v.chiefComplaint) details.push({ label: "Chief complaint", value: v.chiefComplaint });
  if (v.examination) details.push({ label: "Examination", value: v.examination });
  if (v.notes) details.push({ label: "Notes", value: v.notes });
  const linked: string[] = [];
  if (v._count?.diagnoses) linked.push(`${v._count.diagnoses} diagnosis`);
  if (v._count?.prescriptions) linked.push(`${v._count.prescriptions} prescription`);
  if (v._count?.labOrders) linked.push(`${v._count.labOrders} lab order`);
  if (linked.length) details.push({ label: "Linked", value: linked.join(" · ") });
  return {
    key: `visit-${v.id}`,
    kind: "visit",
    at: v.createdAt,
    title: formatDate(v.createdAt),
    reference: v.visitNumber,
    doctor: doctorName(v.doctor),
    status: visitBadge(v),
    details,
  };
}

function admissionEntry(a: PatientHistoryResult["admissions"][number]): TimelineEntry {
  const details: { label: string; value: string }[] = [];
  if (a.bed) {
    details.push({
      label: "Bed",
      value: [a.bed.bedNumber, a.bed.bedClass].filter(Boolean).join(" · "),
    });
  }
  if (a.reason) details.push({ label: "Reason", value: a.reason });
  if (a.dischargeDate) details.push({ label: "Discharged", value: formatDate(a.dischargeDate) });
  else if (a.expectedDischargeDate) {
    details.push({ label: "Expected discharge", value: formatDate(a.expectedDischargeDate) });
  }
  return {
    key: `admission-${a.id}`,
    kind: "admission",
    at: a.admissionDate,
    title: `Admitted ${formatDate(a.admissionDate)}`,
    reference: a.admissionNumber,
    doctor: doctorName(a.doctor),
    status: ADMISSION_STATUS[a.status] ?? { label: a.status, badge: "bg-slate-500/15 text-slate-500 border-slate-400/30" },
    details,
  };
}

function timeOf(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function PatientHistoryPage() {
  const [selected, setSelected] = useState<PatientListRecord | null>(null);
  const [history, setHistory] = useState<PatientHistoryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");

  // Load the selected patient's timeline.
  useEffect(() => {
    if (!selected) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      patientApi
        .history(selected.id)
        .then((r) => {
          if (!active) return;
          setHistory(r);
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
  }, [selected, reload]);

  const timeline = useMemo<TimelineEntry[]>(() => {
    if (!history) return [];
    return [
      ...history.appointments.map(appointmentEntry),
      ...history.visits.map(visitEntry),
      ...history.admissions.map(admissionEntry),
    ].sort((a, b) => timeOf(b.at) - timeOf(a.at));
  }, [history]);

  const counts = useMemo(
    () => ({
      appointment: history?.appointments.length ?? 0,
      visit: history?.visits.length ?? 0,
      admission: history?.admissions.length ?? 0,
    }),
    [history],
  );

  const shown = useMemo(
    () => (filter === "all" ? timeline : timeline.filter((e) => e.kind === filter)),
    [timeline, filter],
  );

  const stats = useMemo(() => {
    const activeAdmission = history?.admissions.some(
      (a) => a.status === "ADMITTED" || a.status === "TRANSFERRED",
    );
    return {
      encounters: timeline.length,
      total: counts.appointment + counts.visit + counts.admission,
      last: timeline.length ? timeline[0].title : "—",
      activeAdmission: !!activeAdmission,
    };
  }, [history, timeline, counts]);

  const pick = (patient: PatientListRecord) => {
    setSelected(patient);
    setHistory(null);
    setError("");
    setFilter("all");
  };

  const refresh = () => {
    setReload((t) => t + 1);
  };

  const filterChips: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: stats.total },
    { id: "appointment", label: "Appointments", count: counts.appointment },
    { id: "visit", label: "Consultations", count: counts.visit },
    { id: "admission", label: "Admissions", count: counts.admission },
  ];

  const patient = history?.patient ?? null;

  return (
    <div className="space-y-4">
      <PatientSearchPicker
        title="Patient History Tracking"
        description="Search a patient to see every appointment, consultation and admission on one timeline."
        selectedId={selected?.id ?? null}
        onPick={pick}
      />

      {/* Timeline */}
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
            <button
              onClick={() => {
                setSelected(null);
                setHistory(null);
              }}
              className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors cursor-pointer"
            >
              Choose another patient
            </button>
          </div>

          {error && (
            <div className="alert-error text-xs flex items-center justify-between">
              {error}
              <button onClick={refresh} className="text-xs font-bold underline cursor-pointer">
                Retry
              </button>
            </div>
          )}

          {/* Summary tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total encounters", value: String(stats.encounters), icon: FiActivity },
              { label: "Appointments", value: String(counts.appointment), icon: FiCalendar },
              { label: "Consultations", value: String(counts.visit), icon: FiClipboard },
              { label: "Admissions", value: String(counts.admission), icon: FiHome },
            ].map((tile) => (
              <div key={tile.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
                <div className="flex items-center gap-2 text-[var(--muted)]">
                  <tile.icon className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-extrabold tracking-widest">{tile.label}</span>
                </div>
                <p className="text-2xl font-black text-[var(--primary-dark)] mt-1">{tile.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap text-[11px] font-bold text-[var(--muted)]">
            <span>
              Latest encounter: <span className="text-[var(--text)]">{stats.last}</span>
            </span>
            {stats.activeAdmission && (
              <span className="text-[10px] font-bold text-violet-600 border border-violet-400/40 bg-violet-500/10 rounded-full px-2 py-0.5">
                Currently admitted
              </span>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setFilter(chip.id)}
                className={`px-3 py-1.5 rounded-full border text-[11px] font-bold transition-colors cursor-pointer ${
                  filter === chip.id
                    ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                    : "bg-[var(--bg)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {chip.label}
                <span className={`ml-1.5 ${filter === chip.id ? "text-white/80" : "text-[var(--muted)]"}`}>
                  {chip.count}
                </span>
              </button>
            ))}
          </div>

          {/* Entries */}
          {loading ? (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
              <p className="text-xs font-bold text-[var(--muted)] mt-3">Loading history…</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
              <FiFileText className="w-6 h-6 mx-auto mb-2 text-[var(--muted)] opacity-50" />
              <p className="text-xs font-bold text-[var(--muted)]">
                {timeline.length === 0
                  ? "This patient has no recorded visits yet."
                  : "No entries match this filter."}
              </p>
            </div>
          ) : (
            <ol className="relative space-y-3">
              {shown.map((entry) => {
                const meta = KIND_META[entry.kind];
                return (
                  <li
                    key={entry.key}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.dot}`}
                        >
                          <meta.icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-[var(--text)]">{entry.title}</span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${meta.chip}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--muted)] font-semibold mt-0.5">
                            {[entry.reference, entry.doctor].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${entry.status.badge}`}
                      >
                        {entry.status.label}
                      </span>
                    </div>

                    {entry.details.length > 0 && (
                      <dl className="mt-2 pl-12 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                        {entry.details.map((d) => (
                          <div key={`${entry.key}-${d.label}`} className="flex gap-1.5 text-[11px] min-w-0">
                            <dt className="font-bold text-[var(--muted)] shrink-0">{d.label}:</dt>
                            <dd className="text-[var(--text)] truncate">{d.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
