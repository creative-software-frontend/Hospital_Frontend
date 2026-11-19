"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiRefreshCcw } from "react-icons/fi";
import {
  employeeAttendanceApi,
  errorMessage,
  type EmployeeAttendanceRecord,
  type EmployeeAttendanceStatus,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem } from "@/app/patients/Toast";

const STATUSES: EmployeeAttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE"];

interface Row {
  employeeId: number;
  name: string;
  employeeCode: string;
  attendanceId: number | null;
  status: EmployeeAttendanceStatus;
  checkInTime: string;
  checkOutTime: string;
  notes: string;
}

export function EmployeeAttendancePage({ onBack }: { onBack?: () => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((kind: ToastItem["kind"], message: string) => {
    toastId.current += 1;
    setToasts((prev) => [...prev.slice(-3), { id: toastId.current, kind, message }]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await employeeAttendanceApi.forDate(date);
      setRows(
        result.map((r) => ({
          employeeId: r.employee.id,
          name: r.employee.name,
          employeeCode: r.employee.employeeCode,
          attendanceId: r.attendance?.id ?? null,
          status: (r.attendance?.status as EmployeeAttendanceStatus) ?? "PRESENT",
          checkInTime: r.attendance?.checkInTime ?? "",
          checkOutTime: r.attendance?.checkOutTime ?? "",
          notes: r.attendance?.notes ?? "",
        })),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const updateRow = (employeeId: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.employeeId === employeeId ? { ...r, ...patch } : r)));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await employeeAttendanceApi.bulk({
        date,
        entries: rows.map((r) => ({
          employeeId: r.employeeId,
          status: r.status,
          checkInTime: r.checkInTime || null,
          checkOutTime: r.checkOutTime || null,
          notes: r.notes || null,
        })),
      });
      notify("success", "Attendance saved.");
      load();
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const summary = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      {onBack && (
        <button
          onClick={onBack}
          className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] cursor-pointer"
        >
          ← Back to Human Resource Management
        </button>
      )}
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Human Resource Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Attendance Management</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">Mark daily attendance for employees.</p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-[var(--muted)]">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="ml-2 h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold"
            />
          </label>
          <button
            onClick={saveAll}
            disabled={saving || rows.length === 0}
            className="h-10 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            {saving ? "Saving…" : "Save all"}
          </button>
          <div className="flex flex-wrap gap-2 ml-auto">
            {STATUSES.map((s) => (
              <span
                key={s}
                className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] font-bold text-[var(--muted)]"
              >
                {s}: {summary[s] ?? 0}
              </span>
            ))}
          </div>
        </div>

        {error && <p className="text-sm alert-error">{error}</p>}

        {loading ? (
          <p className="text-xs text-[var(--muted)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No employees found for this branch.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-3 pr-4">Employee</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Check-in</th>
                  <th className="py-3 pr-4">Check-out</th>
                  <th className="py-3 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeId} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 pr-4 font-bold text-[var(--primary-dark)]">
                      {r.name}
                      <span className="block text-[10px] font-normal text-[var(--muted)]">{r.employeeCode}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={r.status}
                        onChange={(e) => updateRow(r.employeeId, { status: e.target.value as EmployeeAttendanceStatus })}
                        className="h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-2 text-xs font-semibold"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="time"
                        value={r.checkInTime}
                        onChange={(e) => updateRow(r.employeeId, { checkInTime: e.target.value })}
                        className="h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-2 text-xs font-semibold"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="time"
                        value={r.checkOutTime}
                        onChange={(e) => updateRow(r.employeeId, { checkOutTime: e.target.value })}
                        className="h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-2 text-xs font-semibold"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        value={r.notes}
                        onChange={(e) => updateRow(r.employeeId, { notes: e.target.value })}
                        placeholder="Notes"
                        className="h-9 w-40 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-2 text-xs font-semibold"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
