// app/doctors/DoctorAttendancePage.tsx
// Sub-feature "Doctor Attendance": mark doctors present/absent/late per day.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";
import {
  doctorApi,
  doctorAttendanceApi,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "HALF_DAY", label: "Half day" },
  { value: "ON_LEAVE", label: "On leave" },
];

const STATUS_STYLES: Record<string, string> = {
  PRESENT: "bg-emerald-50 text-emerald-600 border-emerald-200",
  ABSENT: "bg-rose-50 text-rose-600 border-rose-200",
  LATE: "bg-amber-50 text-amber-600 border-amber-200",
  HALF_DAY: "bg-sky-50 text-sky-600 border-sky-200",
  ON_LEAVE: "bg-slate-100 text-slate-500 border-slate-200",
};

interface Row {
  doctorId: number;
  name: string;
  code: string;
  attendanceId: number | null;
  status: string;
  checkIn: string;
  checkOut: string;
  notes: string;
  dirty: boolean;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-[11px] font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function DoctorAttendancePage() {
  const [date, setDate] = useState(todayIso());
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async (d: string, search: string) => {
    const query = search.trim();
    if (!query) {
      setRows([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [data, doctors] = await Promise.all([
        doctorAttendanceApi.forDate(d),
        doctorApi.list({ page: 1, limit: 100, search: query }),
      ]);
      const doctorIds = new Set(doctors.data.map((doctor) => doctor.id));
      const list = Array.isArray(data) ? data : [];
      const next: Row[] = list.map((r) => ({
        doctorId: r.doctor.id,
        name: r.doctor.name,
        code: r.doctor.doctorCode,
        attendanceId: r.attendance?.id ?? null,
        status: r.attendance?.status ?? "PRESENT",
        checkIn: r.attendance?.checkInTime ?? "",
        checkOut: r.attendance?.checkOutTime ?? "",
        notes: r.attendance?.notes ?? "",
        dirty: false,
      })).filter((row) => doctorIds.has(row.doctorId));
      setRows(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(date, searchTerm), 0);
    return () => clearTimeout(timer);
  }, [date, load, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const updateRow = (doctorId: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.doctorId === doctorId ? { ...r, ...patch, dirty: true } : r)));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const entries = rows.map((r) => ({
        doctorId: r.doctorId,
        status: r.status as "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "ON_LEAVE",
        checkInTime: r.checkIn || null,
        checkOutTime: r.checkOut || null,
        notes: r.notes || null,
      }));
      await doctorAttendanceApi.bulk({ date, entries });
      notify("success", `Attendance saved for ${date}.`);
      await load(date, searchTerm);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-4">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Doctor Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
          Doctor Attendance
        </h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Mark each doctor present, absent, late, on leave or half-day for a given date.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <label htmlFor="da-doctor-search" className="block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1">
              Search doctor
            </label>
            <input
              id="da-doctor-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or doctor ID"
              className="w-full sm:w-64 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            />
          </div>
          <div>
            <label htmlFor="da-date" className="block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1">
              Date
            </label>
            <input
              id="da-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold">
            {STATUS_OPTIONS.map((s) => (
              <span
                key={s.value}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border ${STATUS_STYLES[s.value]}`}
              >
                {s.label}: {counts[s.value] ?? 0}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]">
              Unmarked: {rows.filter((r) => !r.attendanceId).length}
            </span>
          </div>

          <button
            onClick={saveAll}
            disabled={saving || rows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            <FiSave className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save all"}
          </button>
        </div>

        {error && <p className="text-sm alert-error">{error}</p>}

        {loading ? (
          <div className="py-10 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
            <p className="text-xs font-bold text-[var(--muted)]">
              {searchTerm ? "No doctors match your search." : "Search for a doctor to view attendance."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-[760px] w-full">
              <thead>
                <tr className="bg-[var(--bg)]">
                  {["Doctor", "Status", "Check-in", "Check-out", "Notes"].map((col) => (
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
                {rows.map((r) => (
                  <tr key={r.doctorId} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <p className="text-[12px] font-bold text-[var(--text)]">{r.name}</p>
                      <p className="text-[10px] font-bold text-[var(--primary-dark)]">{r.code}</p>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <select
                        value={r.status}
                        onChange={(e) => updateRow(r.doctorId, { status: e.target.value })}
                        className={`bg-[var(--bg)] border rounded-xl px-2.5 py-1.5 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-[var(--primary)]/15 ${STATUS_STYLES[r.status]}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <input
                        type="time"
                        value={r.checkIn}
                        onChange={(e) => updateRow(r.doctorId, { checkIn: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <input
                        type="time"
                        value={r.checkOut}
                        onChange={(e) => updateRow(r.doctorId, { checkOut: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <input
                        type="text"
                        value={r.notes}
                        onChange={(e) => updateRow(r.doctorId, { notes: e.target.value })}
                        placeholder="Optional note"
                        className={INPUT_CLS}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
