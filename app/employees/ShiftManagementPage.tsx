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

const INPUT = "w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)]";
const EMPTY_FORM: CreateShiftTypeInput = {
  name: "",
  startTime: "",
  endTime: "",
  graceMinutes: 0,
  status: "active",
};

export function ShiftManagementPage({ onBack }: { onBack?: () => void }) {
  const [rows, setRows] = useState<ShiftTypeRecord[]>([]);
  const [search, setSearch] = useState("");
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await shiftTypeApi.list({ search: search.trim() || undefined });
      setRows(result.shiftTypes);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

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
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      notify("error", "End time must be after start time.");
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

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        {onBack && (
          <button onClick={onBack} className="text-xs font-bold text-[var(--primary)] mb-3 cursor-pointer">
            {"\u2190"} Back
          </button>
        )}
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Human Resource</span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Shift Management</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">Create and maintain reusable work shifts for staff scheduling.</p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h4 className="text-sm font-extrabold">{editing ? "Edit shift" : "Add shift"}</h4>
          {editing && <button onClick={reset} className="text-xs font-bold text-[var(--muted)] cursor-pointer">Cancel</button>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,20rem)_9rem_9rem_8rem_8rem_auto] gap-3 items-end">
          <label className="text-xs font-semibold text-[var(--muted)]">Shift name *
            <input className={`${INPUT} mt-1`} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Morning Shift" />
          </label>
          <label className="text-xs font-semibold text-[var(--muted)]">Start
            <input type="time" className={`${INPUT} mt-1`} value={form.startTime ?? ""} onChange={(e) => setForm((v) => ({ ...v, startTime: e.target.value || null }))} />
          </label>
          <label className="text-xs font-semibold text-[var(--muted)]">End
            <input type="time" className={`${INPUT} mt-1`} value={form.endTime ?? ""} onChange={(e) => setForm((v) => ({ ...v, endTime: e.target.value || null }))} />
          </label>
          <label className="text-xs font-semibold text-[var(--muted)]">Grace (min)
            <input type="number" min={0} max={1440} className={`${INPUT} mt-1`} value={form.graceMinutes ?? 0} onChange={(e) => setForm((v) => ({ ...v, graceMinutes: Number(e.target.value) }))} />
          </label>
          <label className="text-xs font-semibold text-[var(--muted)]">Status
            <select className={`${INPUT} mt-1`} value={form.status ?? "active"} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value as "active" | "inactive" }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <button onClick={submit} disabled={saving} className="h-10 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-60 cursor-pointer" style={{ background: "var(--primary)" }}>
            {saving ? "Saving..." : editing ? "Save" : "Add shift"}
          </button>
        </div>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold">Configured shifts</h4>
            <p className="text-xs text-[var(--muted)]">{rows.length} shift(s)</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input className="pl-9 h-10 w-56 max-w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shifts..." />
            </div>
            <button onClick={() => setReloadKey((key) => key + 1)} className="h-10 w-10 rounded-xl border border-[var(--border)] text-[var(--muted)] cursor-pointer" title="Refresh"><FiRefreshCcw className="mx-auto w-4 h-4" /></button>
          </div>
        </div>
        {error && <p className="text-sm alert-error">{error}</p>}
        {loading ? <p className="text-xs text-[var(--muted)]">Loading shifts...</p> : rows.length === 0 ? <p className="text-xs text-[var(--muted)]">No shifts configured yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b border-[var(--border)] text-[var(--muted)]"><th className="py-3 pr-4">Name</th><th className="py-3 pr-4">Time</th><th className="py-3 pr-4">Grace</th><th className="py-3 pr-4">Status</th><th className="py-3 text-right">Action</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id} className="border-b border-[var(--border)] last:border-0"><td className="py-3 pr-4 font-bold">{row.name}</td><td className="py-3 pr-4">{row.startTime ?? "—"} - {row.endTime ?? "—"}</td><td className="py-3 pr-4">{row.graceMinutes} min</td><td className="py-3 pr-4"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${row.status === "active" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>{row.status}</span></td><td className="py-3 text-right"><button onClick={() => edit(row)} className="inline-flex items-center gap-1 text-[var(--primary)] font-bold cursor-pointer"><FiEdit2 className="w-3.5 h-3.5" /> Edit</button></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}
