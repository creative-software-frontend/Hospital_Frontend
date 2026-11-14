"use client";

import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiRefreshCcw, FiSearch } from "react-icons/fi";
import {
  errorMessage,
  shiftTypeApi,
  type CreateShiftTypeInput,
  type ShiftTypeRecord,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const INPUT = "w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 transition-colors";
const LABEL = "block text-[11px] font-bold text-[var(--muted)] mb-1";
const EMPTY_FORM: CreateShiftTypeInput = {
  name: "",
  startTime: "",
  endTime: "",
  graceMinutes: 0,
  status: "active",
};

export function ShiftManagementPage({ onBack, module = "Nursing Management" }: { onBack?: () => void; module?: string }) {
  const [rows, setRows] = useState<ShiftTypeRecord[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<CreateShiftTypeInput>(EMPTY_FORM);
  const [editing, setEditing] = useState<ShiftTypeRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const notify = useCallback((kind: ToastKind, message: string) => {
    setToasts((prev) => [...prev.slice(-3), { id: Date.now() + Math.random(), kind, message }]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await shiftTypeApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setRows(result.shiftTypes);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const reset = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
  };

  const edit = (row: ShiftTypeRecord) => {
    setEditing(row);
    setForm({
      name: row.name,
      startTime: row.startTime ?? "",
      endTime: row.endTime ?? "",
      graceMinutes: row.graceMinutes,
      status: row.status === "inactive" ? "inactive" : "active",
    });
  };

  const submit = async () => {
    if (!form.name?.trim()) {
      notify("error", "Shift name is required.");
      return;
    }
    if (form.startTime && form.endTime && form.startTime === form.endTime) {
      notify("error", "Start time and end time cannot be identical.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await shiftTypeApi.update(editing.id, form);
        notify("success", "Shift updated.");
      } else {
        await shiftTypeApi.create(form);
        notify("success", "Shift created.");
      }
      reset();
      setReloadKey((key) => key + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const filtersActive = Boolean(searchInput.trim() || statusFilter);

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        {onBack && (
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] mb-3 transition-colors cursor-pointer">
            {"\u2190"} Back
          </button>
        )}
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">{module}</span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Shift Management</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">Create and maintain reusable work shifts for staff scheduling.</p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">{editing ? "Edit shift" : "Add shift"}</h4>
            <p className="text-xs text-[var(--muted)] mt-0.5">{editing ? `Editing "${editing.name}"` : "Configure shift name, start and end times, grace period, and status."}</p>
          </div>
          {editing && <button onClick={reset} className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-bold text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer">Cancel</button>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end max-w-4xl">
          <div className="sm:col-span-2 lg:col-span-2">
            <label className={LABEL}>Shift name *</label>
            <input className={INPUT} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="e.g. Morning Shift" />
          </div>
          <div>
            <label className={LABEL}>Start</label>
            <input type="time" className={INPUT} value={form.startTime ?? ""} onChange={(e) => setForm((v) => ({ ...v, startTime: e.target.value || null }))} />
          </div>
          <div>
            <label className={LABEL}>End</label>
            <input type="time" className={INPUT} value={form.endTime ?? ""} onChange={(e) => setForm((v) => ({ ...v, endTime: e.target.value || null }))} />
          </div>
          <div>
            <label className={LABEL}>Grace (min)</label>
            <input type="number" min={0} max={1440} className={INPUT} value={form.graceMinutes ?? 0} onChange={(e) => setForm((v) => ({ ...v, graceMinutes: Math.max(0, Number(e.target.value)) }))} />
          </div>
          <div>
            <label className={LABEL}>Status</label>
            <select className={INPUT} value={form.status ?? "active"} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value as "active" | "inactive" }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={submit} disabled={saving} className="h-10 rounded-xl px-5 text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 cursor-pointer" style={{ background: "var(--primary)" }}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add shift"}
          </button>
          {editing && (
            <button onClick={reset} className="h-10 px-4 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Configured shifts</h4>
            <p className="text-xs text-[var(--muted)]">{rows.length} shift(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                className="pl-9 h-10 w-48 sm:w-56 max-w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 transition-colors"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search shifts..."
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "inactive")}
              className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 transition-colors text-[var(--text)] cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {filtersActive && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setStatusFilter("");
                }}
                className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setReloadKey((key) => key + 1)}
              className="h-10 w-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)]/20 transition-colors cursor-pointer flex items-center justify-center"
              title="Refresh"
            >
              <FiRefreshCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {error && <p className="text-sm alert-error">{error}</p>}
        {loading ? (
          <p className="text-xs text-[var(--muted)]">Loading shifts...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
            <p className="text-xs font-bold text-[var(--muted)]">
              {filtersActive ? "No shifts match this filter." : "No shifts configured yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]">
                  <th className="py-3 px-4 font-bold">Name</th>
                  <th className="py-3 px-4 font-bold">Time</th>
                  <th className="py-3 px-4 font-bold">Grace</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="py-3 px-4 font-bold text-[var(--text)]">{row.name}</td>
                    <td className="py-3 px-4 font-semibold text-[var(--text)]">
                      {row.startTime ?? "—"} - {row.endTime ?? "—"}
                      {row.startTime && row.endTime && row.endTime < row.startTime && (
                        <span className="ml-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                          Overnight
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[var(--muted)]">{row.graceMinutes} min</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold capitalize ${row.status === "active" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => edit(row)} className="inline-flex items-center gap-1 text-[var(--primary)] hover:text-[var(--primary-dark)] font-bold transition-colors cursor-pointer">
                        <FiEdit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}
