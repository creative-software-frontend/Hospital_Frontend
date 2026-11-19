"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiEdit2, FiRefreshCcw, FiSearch, FiTrash2 } from "react-icons/fi";
import {
  errorMessage,
  leaveTypeApi,
  type CreateLeaveTypeInput,
  type LeaveTypeRecord,
  type LeaveTypeStatus,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const INPUT = "w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)]";

const EMPTY_FORM: CreateLeaveTypeInput = {
  name: "",
  daysAllowed: 0,
  paid: true,
  status: "active",
};

export function LeaveManagementPage({ onBack }: { onBack?: () => void }) {
  const [rows, setRows] = useState<LeaveTypeRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<CreateLeaveTypeInput>(EMPTY_FORM);
  const [editing, setEditing] = useState<LeaveTypeRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);

  const notify = useCallback((kind: ToastKind, message: string) => {
    toastId.current += 1;
    setToasts((prev) => [...prev.slice(-3), { id: toastId.current, kind, message }]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await leaveTypeApi.list({ search: search.trim() || undefined });
      setRows(result.leaveTypes);
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

  const edit = (row: LeaveTypeRecord) => {
    setEditing(row);
    setForm({ name: row.name, daysAllowed: row.daysAllowed, paid: row.paid, status: row.status });
  };

  const submit = async () => {
    if (!form.name?.trim()) {
      notify("error", "Leave type name is required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await leaveTypeApi.update(editing.id, form);
        notify("success", "Leave type updated.");
      } else {
        await leaveTypeApi.create(form);
        notify("success", "Leave type created.");
      }
      reset();
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: LeaveTypeRecord) => {
    if (!window.confirm(`Delete leave type "${row.name}"?`)) return;
    try {
      await leaveTypeApi.remove(row.id);
      notify("success", "Leave type deleted.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    }
  };

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
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Leave Management</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">Manage leave types (annual, sick, casual, etc.).</p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h4 className="text-sm font-extrabold">{editing ? "Edit leave type" : "Add leave type"}</h4>
          {editing && (
            <button onClick={reset} className="text-xs font-bold text-[var(--muted)] cursor-pointer">
              Cancel
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,16rem)_8rem_8rem_8rem_10rem] gap-3 items-end max-w-3xl">
          <label className="text-xs font-semibold text-[var(--muted)]">Name *
            <input
              className={`${INPUT} mt-1`}
              value={form.name ?? ""}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              placeholder="Annual Leave"
            />
          </label>
          <label className="text-xs font-semibold text-[var(--muted)]">Days allowed
            <input
              type="number"
              min={0}
              max={365}
              className={`${INPUT} mt-1`}
              value={form.daysAllowed ?? 0}
              onChange={(e) => setForm((v) => ({ ...v, daysAllowed: Number(e.target.value) }))}
            />
          </label>
          <label className="text-xs font-semibold text-[var(--muted)]">Paid
            <select
              className={`${INPUT} mt-1`}
              value={form.paid ? "yes" : "no"}
              onChange={(e) => setForm((v) => ({ ...v, paid: e.target.value === "yes" }))}
            >
              <option value="yes">Paid</option>
              <option value="no">Unpaid</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--muted)]">Status
            <select
              className={`${INPUT} mt-1`}
              value={form.status ?? "active"}
              onChange={(e) => setForm((v) => ({ ...v, status: e.target.value as "active" | "inactive" }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <button
            onClick={submit}
            disabled={saving}
            className="h-10 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            {saving ? "Saving…" : editing ? "Save" : "Add leave type"}
          </button>
        </div>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold">Configured leave types</h4>
            <p className="text-xs text-[var(--muted)]">{rows.length} type(s)</p>
          </div>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
            <input
              className="pl-9 h-10 w-56 max-w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leave types..."
            />
          </div>
        </div>
        {error && <p className="text-sm alert-error">{error}</p>}
        {loading ? (
          <p className="text-xs text-[var(--muted)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No leave types configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Days allowed</th>
                  <th className="py-3 pr-4">Paid</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => !search.trim() || r.name.toLowerCase().includes(search.toLowerCase()))
                  .map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 pr-4 font-bold text-[var(--primary-dark)]">{row.name}</td>
                      <td className="py-3 pr-4">{row.daysAllowed} days</td>
                      <td className="py-3 pr-4">{row.paid ? "Paid" : "Unpaid"}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
                            row.status === "active"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => edit(row)}
                            className="inline-flex items-center gap-1 text-[var(--primary)] font-bold cursor-pointer"
                          >
                            <FiEdit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => remove(row)}
                            className="inline-flex items-center gap-1 text-rose-500 font-bold cursor-pointer ml-2"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
