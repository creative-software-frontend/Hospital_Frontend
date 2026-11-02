// app/doctors/DoctorPerformanceReportPage.tsx
// Sub-feature "Doctor Performance Report": per-doctor summary over a date range.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiDownload, FiRefreshCcw, FiSearch } from "react-icons/fi";
import {
  doctorApi,
  errorMessage,
  type DoctorPerformanceRow,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem } from "@/app/patients/Toast";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const INPUT_CLS =
  "bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function DoctorPerformanceReportPage() {
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [rows, setRows] = useState<DoctorPerformanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    if (!searchTerm) {
      setRows([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await doctorApi.performanceReport({ from, to });
      const query = searchTerm.toLowerCase();
      setRows(
        (Array.isArray(data) ? data : []).filter((row) =>
          [row.name, row.doctorCode, row.specialization ?? ""].some((value) =>
            value.toLowerCase().includes(query),
          ),
        ),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [from, searchTerm, to]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const exportCsv = () => {
    const header = [
      "Doctor",
      "Code",
      "Specialty",
      "Appointments",
      "Completed",
      "Cancelled",
      "No-show",
      "Consultations",
      "Revenue",
      "Commission earned",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          `"${r.name}"`,
          r.doctorCode,
          `"${r.specialization ?? ""}"`,
          r.appointmentsTotal,
          r.completed,
          r.cancelled,
          r.noShow,
          r.consultations,
          r.revenue.toFixed(2),
          r.commissionEarned.toFixed(2),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doctor-performance-${from}-to-${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totals = rows.reduce(
    (acc, r) => {
      acc.appointments += r.appointmentsTotal;
      acc.completed += r.completed;
      acc.cancelled += r.cancelled;
      acc.noShow += r.noShow;
      acc.consultations += r.consultations;
      acc.revenue += r.revenue;
      acc.commission += r.commissionEarned;
      return acc;
    },
    { appointments: 0, completed: 0, cancelled: 0, noShow: 0, consultations: 0, revenue: 0, commission: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Doctor Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
          Doctor Performance Report
        </h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Per-doctor summary of appointments, consultations, revenue and commission over a date range.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label htmlFor="pr-from" className="block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1">
                From
              </label>
              <input
                id="pr-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label htmlFor="pr-search" className="block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1">
                Search doctor
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]" />
                <input
                  id="pr-search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Name, ID or specialty"
                  className={`${INPUT_CLS} pl-9 w-56`}
                />
              </div>
            </div>
            <div>
              <label htmlFor="pr-to" className="block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1">
                To
              </label>
              <input
                id="pr-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const d = new Date();
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                setFrom(`${y}-${m}-01`);
                setTo(`${y}-${m}-${String(d.getDate()).padStart(2, "0")}`);
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              This month
            </button>
            <button
              onClick={load}
              className="p-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              title="Refresh"
            >
              <FiRefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              style={{ background: "var(--primary)" }}
            >
              <FiDownload className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {error && <p className="text-sm alert-error">{error}</p>}

        {loading ? (
          <div className="py-10 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
            <p className="text-xs font-bold text-[var(--muted)]">No doctors in this branch.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-[900px] w-full">
              <thead>
                <tr className="bg-[var(--bg)]">
                  {["Doctor", "Specialty", "Appointments", "Completed", "Cancelled", "No-show", "Consultations", "Revenue", "Commission"].map((col) => (
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
                      <p className="text-[10px] font-bold text-[var(--primary-dark)]">{r.doctorCode}</p>
                    </td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                      {r.specialization ?? "—"}
                    </td>
                    <td className="text-[12px] font-semibold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {r.appointmentsTotal}
                    </td>
                    <td className="text-[12px] font-semibold text-emerald-600 px-4 py-3 border-b border-[var(--border)]">
                      {r.completed}
                    </td>
                    <td className="text-[12px] font-semibold text-rose-600 px-4 py-3 border-b border-[var(--border)]">
                      {r.cancelled}
                    </td>
                    <td className="text-[12px] font-semibold text-amber-600 px-4 py-3 border-b border-[var(--border)]">
                      {r.noShow}
                    </td>
                    <td className="text-[12px] font-semibold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {r.consultations}
                    </td>
                    <td className="text-[12px] font-semibold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {r.revenue.toFixed(2)}
                    </td>
                    <td className="text-[12px] font-semibold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {r.commissionEarned.toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[var(--bg)] font-bold">
                  <td className="px-4 py-3 text-[12px] text-[var(--text)]" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[var(--text)]">{totals.appointments}</td>
                  <td className="px-4 py-3 text-[12px] text-emerald-600">{totals.completed}</td>
                  <td className="px-4 py-3 text-[12px] text-rose-600">{totals.cancelled}</td>
                  <td className="px-4 py-3 text-[12px] text-amber-600">{totals.noShow}</td>
                  <td className="px-4 py-3 text-[12px] text-[var(--text)]">{totals.consultations}</td>
                  <td className="px-4 py-3 text-[12px] text-[var(--text)]">{totals.revenue.toFixed(2)}</td>
                  <td className="px-4 py-3 text-[12px] text-[var(--text)]">{totals.commission.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
