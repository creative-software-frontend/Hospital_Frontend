// app/appointments/AppointmentModule.tsx
// Live "Appointment Management" module (feature id = 3 in the dashboard).
// Backed by GET/POST /api/opd/appointments and PATCH /api/opd/appointments/:id.
// Lists appointments for the caller's branch with date / doctor / status
// filters, a "Schedule New" modal, and per-row status actions
// (check-in → in-consultation → complete, plus cancel / no-show).

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiRefreshCcw, FiX, FiSearch } from "react-icons/fi";
import {
  appointmentApi,
  doctorApi,
  patientApi,
  errorMessage,
  formatDate,
  type AppointmentRecord,
  type AppointmentStatus,
  type AppointmentVisitType,
  type DoctorRecord,
  type PaginationMeta,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const PAGE_SIZE = 10;
const TODAY = new Date().toISOString().slice(0, 10);

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

const STATUS_STYLES: Record<AppointmentStatus, { label: string; badge: string }> = {
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

type ActionTone = "emerald" | "violet" | "rose" | "slate";

const TONE_CLS: Record<ActionTone, string> = {
  emerald: "text-emerald-600 border-emerald-400/40 hover:bg-emerald-500/10",
  violet: "text-violet-600 border-violet-400/40 hover:bg-violet-500/10",
  rose: "text-rose-500 border-rose-400/40 hover:bg-rose-500/10",
  slate: "text-slate-500 border-slate-400/40 hover:bg-slate-500/10",
};

interface StatusAction {
  to: AppointmentStatus;
  label: string;
  tone: ActionTone;
  /** Open a note dialog before applying (cancel / no-show). */
  withNote?: boolean;
}

const STATUS_ACTIONS: Record<AppointmentStatus, StatusAction[]> = {
  SCHEDULED: [
    { to: "CHECKED_IN", label: "Check in", tone: "emerald" },
    { to: "NO_SHOW", label: "No show", tone: "slate", withNote: true },
    { to: "CANCELLED", label: "Cancel", tone: "rose", withNote: true },
  ],
  CHECKED_IN: [
    { to: "IN_CONSULTATION", label: "Start", tone: "violet" },
    { to: "NO_SHOW", label: "No show", tone: "slate", withNote: true },
    { to: "CANCELLED", label: "Cancel", tone: "rose", withNote: true },
  ],
  IN_CONSULTATION: [{ to: "COMPLETED", label: "Complete", tone: "emerald" }],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

interface PendingAction {
  appt: AppointmentRecord;
  to: AppointmentStatus;
  label: string;
}

export function AppointmentModule({ role }: { role: string | null }) {
  const [rows, setRows] = useState<AppointmentRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Filters — date defaults to today so the board opens on the live day.
  const [dateFilter, setDateFilter] = useState<string>(TODAY);
  const [doctorFilter, setDoctorFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Doctor filter options (best-effort).
  useEffect(() => {
    let active = true;
    doctorApi
      .list({ limit: 100, status: "active" })
      .then((r) => {
        if (active) setDoctors(r.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const result = await appointmentApi.list({
        page,
        limit: PAGE_SIZE,
        date: dateFilter || undefined,
        doctorId: doctorFilter ? Number(doctorFilter) : undefined,
        status: (statusFilter || undefined) as AppointmentStatus | undefined,
      });
      setRows(result.data);
      setPagination(result.pagination);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, dateFilter, doctorFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const totalPages = pagination?.totalPages ?? 1;
  const safePage = Math.min(page, Math.max(1, totalPages));
  const colSpan = 6;

  const applyStatus = async (
    id: number,
    to: AppointmentStatus,
    note?: string,
  ): Promise<void> => {
    setBusyId(id);
    try {
      await appointmentApi.update(id, {
        status: to,
        ...(note && note.trim() ? { notes: note.trim() } : {}),
      });
      notify("success", `Appointment marked ${STATUS_STYLES[to].label.toLowerCase()}.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const onAction = (appt: AppointmentRecord, action: StatusAction) => {
    if (action.withNote) {
      setPending({ appt, to: action.to, label: action.label });
    } else {
      void applyStatus(appt.id, action.to);
    }
  };

  const clearFilters = () => {
    setDateFilter("");
    setDoctorFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const handleCreated = () => {
    notify("success", "Appointment scheduled.");
    // Jump back to today so a newly booked slot is visible.
    setDateFilter(TODAY);
    setPage(1);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Outpatient Department
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
          Appointment Management
        </h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Schedule outpatient appointments and move patients through the queue — check in, start
          consultation, complete, cancel or mark a no-show.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Appointments</h4>
            <p className="text-xs text-[var(--muted)]">
              {pagination ? `${pagination.total} appointment(s)` : "Loading…"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className={`${INPUT_CLS} w-40`}
              title="Filter by date"
            />
            <select
              value={doctorFilter}
              onChange={(e) => {
                setDoctorFilter(e.target.value);
                setPage(1);
              }}
              className={`${INPUT_CLS} w-48`}
            >
              <option value="">All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className={`${INPUT_CLS} w-44`}
            >
              <option value="">All statuses</option>
              {(Object.keys(STATUS_STYLES) as AppointmentStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_STYLES[s].label}
                </option>
              ))}
            </select>
            <button
              onClick={clearFilters}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="p-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              title="Refresh"
            >
              <FiRefreshCcw className="w-4 h-4" />
            </button>
            {role !== "doctor" && (
              <button
                onClick={() => setShowSchedule(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98]"
                style={{ background: "var(--primary)" }}
              >
                <FiPlus className="w-3.5 h-3.5" />
                Schedule Appointment
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-sm alert-error">{error}</p>}

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[760px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                {["Patient", "Doctor", "Date", "Time", "Status", "Actions"].map((col) => (
                  <th
                    key={col}
                    className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center text-xs text-[var(--muted)]">
                    <FiSearch className="w-4 h-4 mx-auto mb-2 opacity-60" />
                    No appointments match the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((appt) => {
                  const actions = STATUS_ACTIONS[appt.status] ?? [];
                  return (
                    <tr
                      key={appt.id}
                      className="hover:bg-[var(--primary-soft)]/10 transition-colors align-top"
                    >
                      <td className="text-[12px] px-4 py-3 border-b border-[var(--border)]">
                        <span className="font-bold text-[var(--primary-dark)]">
                          {appt.patient?.name ?? "—"}
                        </span>
                        <div className="text-[11px] text-[var(--muted)]">
                          {appt.patient?.patientCode}
                          {appt.patient?.phone ? ` · ${appt.patient.phone}` : ""}
                        </div>
                      </td>
                      <td className="text-[12px] px-4 py-3 border-b border-[var(--border)]">
                        {appt.doctor?.name ?? "—"}
                        {appt.doctor?.specialization && (
                          <div className="text-[11px] text-[var(--muted)]">
                            {appt.doctor.specialization}
                          </div>
                        )}
                      </td>
                      <td className="text-[12px] px-4 py-3 border-b border-[var(--border)]">
                        {formatDate(appt.appointmentDate)}
                      </td>
                      <td className="text-[12px] px-4 py-3 border-b border-[var(--border)] whitespace-nowrap">
                        {appt.startTime} – {appt.endTime}
                      </td>
                      <td className="px-4 py-3 border-b border-[var(--border)]">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLES[appt.status]?.badge ?? ""}`}
                        >
                          {STATUS_STYLES[appt.status]?.label ?? appt.status}
                        </span>
                        {appt.reason && (
                          <div className="text-[11px] text-[var(--muted)] mt-1 max-w-[160px] truncate" title={appt.reason}>
                            {appt.reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 border-b border-[var(--border)]">
                        {actions.length === 0 ? (
                          <span className="text-[11px] text-[var(--muted)]">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {actions.map((action) => (
                              <button
                                key={action.to}
                                onClick={() => onAction(appt, action)}
                                disabled={busyId === appt.id}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors disabled:opacity-50 ${TONE_CLS[action.tone]}`}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-[var(--muted)]">
            Showing {rows.length} of {pagination?.total ?? 0} rows
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                safePage <= 1
                  ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed"
                  : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"
              }`}
            >
              Previous
            </button>
            <span className="text-xs font-bold text-[var(--muted)]">
              Page {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                safePage >= totalPages
                  ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed"
                  : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showSchedule && (
        <ScheduleModal
          onClose={() => setShowSchedule(false)}
          onCreated={handleCreated}
        />
      )}

      {pending && (
        <StatusActionModal
          pending={pending}
          busy={busyId === pending.appt.id}
          onConfirm={(note) => {
            const { appt, to } = pending;
            setPending(null);
            void applyStatus(appt.id, to, note);
          }}
          onClose={() => setPending(null)}
        />
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Schedule New modal
 * -------------------------------------------------------------------------- */

function ScheduleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patientLabel, setPatientLabel] = useState("");
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [doctorLabel, setDoctorLabel] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorRecord | null>(null);
  const [date, setDate] = useState(TODAY);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [shift, setShift] = useState("");
  const [appointmentPriority, setAppointmentPriority] = useState<"LOW" | "NORMAL" | "HIGH">("NORMAL");
  const [discountPercentage, setDiscountPercentage] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [message, setMessage] = useState("");
  const [alternateAddress, setAlternateAddress] = useState("");
  const [visitType, setVisitType] = useState<AppointmentVisitType>("OPD");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const doctorFee =
    selectedDoctor === null
      ? ""
      : visitType === "FOLLOWUP"
        ? selectedDoctor.followupFee ?? ""
        : selectedDoctor.consultationFee ?? "";

  const fetchPatients = useCallback(async (search: string) => {
    const r = await patientApi.list({ search: search || undefined, limit: 12 });
    return r.data.map((p) => ({
      id: p.id,
      label: p.name,
      sublabel: [p.patientCode, p.phone].filter(Boolean).join(" · "),
    }));
  }, []);

  const fetchDoctors = useCallback(async (search: string) => {
    const r = await doctorApi.list({ search: search || undefined, limit: 12, status: "active" });
    return r.data.map((d) => ({
      id: d.id,
      label: d.name,
      sublabel: [d.specialization || d.doctorCode, d.consultationFee ? `$${d.consultationFee}` : ""]
        .filter(Boolean)
        .join(" · "),
    }));
  }, []);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (patientId == null) next.patientId = "Patient is required";
    if (doctorId == null) next.doctorId = "Doctor is required";
    if (!doctorFee) {
      next.doctorFee =
        visitType === "FOLLOWUP"
          ? "Configure this doctor's follow-up fee in Doctor Management"
          : "Configure this doctor's consultation fee in Doctor Management";
    }
    if (!date) next.date = "Date is required";
    else if (date < TODAY) next.date = "Date cannot be in the past";
    if (!startTime) next.startTime = "Start time is required";
    if (!endTime) next.endTime = "End time is required";
    if (!shift) next.shift = "Shift is required";
    if (doctorFee && !/^\d+(\.\d{1,2})?$/.test(doctorFee)) next.doctorFee = "Enter a valid fee";
    if (discountPercentage && (!/^\d+(\.\d{1,2})?$/.test(discountPercentage) || Number(discountPercentage) > 100)) {
      next.discountPercentage = "Enter a percentage from 0 to 100";
    }
    if (startTime && endTime && endTime <= startTime)
      next.endTime = "End time must be after start time";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setSaving(true);
    try {
      await appointmentApi.create({
        patientId: patientId as number,
        doctorId: doctorId as number,
        appointmentDate: date,
        startTime,
        endTime,
        doctorFee: doctorFee || null,
        shift,
        appointmentPriority,
        discountPercentage: discountPercentage || null,
        paymentMode: paymentMode || null,
        message: message.trim() || null,
        alternateAddress: alternateAddress.trim() || null,
        visitType,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: string) =>
    fieldErrors[key] ? (
      <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors[key]}</p>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
              Outpatient Department
            </span>
            <h3 className="font-black text-lg text-[var(--primary-dark)]">Schedule Appointment</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            title="Close"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          <div>
            <h4 className="text-sm font-black text-[var(--text)]">Appointment Details</h4>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">
              Select the patient, doctor, fee and appointment schedule.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Patient *</label>
              <GenericPicker
                value={patientId}
                valueLabel={patientLabel}
                onChange={(id, label) => {
                  setPatientId(id);
                  setPatientLabel(label);
                  setFieldErrors((p) => ({ ...p, patientId: "" }));
                }}
                placeholder="Search patient…"
                fetchPage={fetchPatients}
              />
              {fieldError("patientId")}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Doctor *</label>
              <GenericPicker
                value={doctorId}
                valueLabel={doctorLabel}
                onChange={(id, label) => {
                  setDoctorId(id);
                  setDoctorLabel(label);
                  setSelectedDoctor(null);
                  if (id != null) {
                    void doctorApi
                      .get(id)
                      .then((result) => {
                        setSelectedDoctor(result.doctor);
                        setFieldErrors((p) => ({ ...p, doctorId: "", doctorFee: "" }));
                      })
                      .catch((err) => setError(errorMessage(err)));
                  }
                  setFieldErrors((p) => ({ ...p, doctorId: "" }));
                }}
                placeholder="Search doctor…"
                fetchPage={fetchDoctors}
              />
              {fieldError("doctorId")}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                {visitType === "FOLLOWUP" ? "Follow-up Fee" : "Consultation Fee"} *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={doctorFee}
                readOnly
                className={`${INPUT_CLS} opacity-70 cursor-not-allowed`}
                placeholder={selectedDoctor ? "Not configured" : "Select a doctor"}
              />
              {fieldError("doctorFee")}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Shift *</label>
              <select
                value={shift}
                onChange={(e) => {
                  setShift(e.target.value);
                  setFieldErrors((p) => ({ ...p, shift: "" }));
                }}
                className={INPUT_CLS}
              >
                <option value="">Select</option>
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Evening">Evening</option>
              </select>
              {fieldError("shift")}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Appointment Date *</label>
              <input
                type="date"
                value={date}
                min={TODAY}
                onChange={(e) => {
                  setDate(e.target.value);
                  setFieldErrors((p) => ({ ...p, date: "" }));
                }}
                className={INPUT_CLS}
              />
              {fieldError("date")}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Start *</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setFieldErrors((p) => ({ ...p, startTime: "", endTime: "" }));
                }}
                className={INPUT_CLS}
              />
              {fieldError("startTime")}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">End *</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setFieldErrors((p) => ({ ...p, endTime: "" }));
                }}
                className={INPUT_CLS}
              />
              {fieldError("endTime")}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-black text-[var(--text)]">Appointment Settings</h4>
            <p className="text-[11px] text-[var(--muted)] mt-0.5 mb-3">
              Set priority, status, discount and consultation preferences.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Appointment Priority</label>
                <select
                  value={appointmentPriority}
                  onChange={(e) => setAppointmentPriority(e.target.value as "LOW" | "NORMAL" | "HIGH")}
                  className={INPUT_CLS}
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Status *</label>
              <input value="Scheduled" readOnly className={`${INPUT_CLS} opacity-70`} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Discount Percentage</label>
              <input
                type="text"
                inputMode="decimal"
                value={discountPercentage}
                onChange={(e) => {
                  setDiscountPercentage(e.target.value);
                  setFieldErrors((p) => ({ ...p, discountPercentage: "" }));
                }}
                className={INPUT_CLS}
                placeholder="0"
              />
              {fieldError("discountPercentage")}
            </div>
            </div>
          </div>

          <div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Payment Mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={INPUT_CLS}>
                <option>Cash</option>
                <option>Card</option>
                <option>Mobile Banking</option>
                <option>Bank Transfer</option>
                <option>Insurance</option>
              </select>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-black text-[var(--text)] mb-3">Additional Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Visit Type</label>
                <select
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value as AppointmentVisitType)}
                  className={INPUT_CLS}
                >
                  <option value="OPD">OPD</option>
                  <option value="FOLLOWUP">Follow-up</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Message</label>
                <input value={message} onChange={(e) => setMessage(e.target.value)} className={INPUT_CLS} placeholder="Optional message" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Reason</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} className={INPUT_CLS} placeholder="Optional reason for the visit" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Alternate Address</label>
                <input value={alternateAddress} onChange={(e) => setAlternateAddress(e.target.value)} className={INPUT_CLS} placeholder="Optional alternate address" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${INPUT_CLS} min-h-[64px]`} placeholder="Optional notes" />
              </div>
            </div>
          </div>

          {error && <p className="text-sm alert-error">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              style={{ background: "var(--primary)" }}
            >
              {saving ? "Scheduling…" : "Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Status-change confirm modal (cancel / no-show) with optional note
 * -------------------------------------------------------------------------- */

function StatusActionModal({
  pending,
  busy,
  onConfirm,
  onClose,
}: {
  pending: PendingAction;
  busy: boolean;
  onConfirm: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const { appt, to, label } = pending;
  const isCancel = to === "CANCELLED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="font-black text-lg text-[var(--primary-dark)]">
            {label} appointment?
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            title="Close"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {appt.patient?.name} with {appt.doctor?.name} on {formatDate(appt.appointmentDate)} at{" "}
            {appt.startTime}. This will set the status to{" "}
            <span className="font-bold text-[var(--text)]">{STATUS_STYLES[to].label}</span>.
          </p>

          <div>
            <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
              {isCancel ? "Reason (optional)" : "Note (optional)"}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${INPUT_CLS} min-h-[64px]`}
              placeholder={
                isCancel ? "Why is this appointment being cancelled?" : "Add an optional note"
              }
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => onConfirm(note)}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              style={{ background: isCancel ? "var(--danger, #e11d48)" : "var(--primary)" }}
            >
              {busy ? "Applying…" : label}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Generic debounced search picker (patient / doctor)
 * -------------------------------------------------------------------------- */

interface PickOption {
  id: number;
  label: string;
  sublabel?: string;
}

function GenericPicker({
  value,
  valueLabel,
  onChange,
  placeholder,
  fetchPage,
}: {
  value: number | null;
  valueLabel: string;
  onChange: (id: number | null, label: string) => void;
  placeholder: string;
  fetchPage: (search: string) => Promise<PickOption[]>;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<PickOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Memoize so the effect below only re-runs when `open`/`term` change.
  const fetchRef = useMemo(() => fetchPage, [fetchPage]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      fetchRef(term.trim())
        .then((r) => {
          if (active) setOptions(r);
        })
        .catch(() => {
          if (active) setOptions([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, term, fetchRef]);

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`${INPUT_CLS} text-left flex items-center justify-between`}
        >
          <span className={value ? "" : "text-[var(--muted)]"}>
            {value ? valueLabel || `#${value}` : placeholder}
          </span>
          {value != null && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null, "");
                setTerm("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange(null, "");
                  setTerm("");
                }
              }}
              className="text-[var(--muted)] hover:text-[var(--text)]"
              title="Clear"
            >
              <FiX className="w-3.5 h-3.5" />
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden">
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Type to search…"
            className="w-full px-3 py-2 text-xs font-semibold outline-none border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
          />
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-3 text-[11px] text-[var(--muted)]">Searching…</p>
            ) : options.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-[var(--muted)]">No matches.</p>
            ) : (
              options.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => {
                    onChange(o.id, o.label);
                    setOpen(false);
                    setTerm("");
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--primary-soft)]/20 transition-colors ${
                    o.id === value ? "bg-[var(--primary-soft)]/15" : ""
                  }`}
                >
                  <span className="font-bold text-[var(--text)]">{o.label}</span>
                  {o.sublabel && (
                    <span className="text-[var(--muted)] ml-2">{o.sublabel}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
