"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiEdit2, FiRefreshCcw, FiTrash2 } from "react-icons/fi";
import {
  employeeApi,
  employeeEvaluationApi,
  errorMessage,
  type CreateEmployeeEvaluationInput,
  type EmployeeEvaluationRecord,
  type EmployeeRecord,
  type UpdateEmployeeEvaluationInput,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const INPUT = "w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)]";

const EMPTY_FORM: CreateEmployeeEvaluationInput = {
  employeeId: 0,
  date: new Date().toISOString().slice(0, 10),
  rating: 3,
  comments: "",
  status: "active",
};

export function EmployeeEvaluationPage({ onBack }: { onBack?: () => void }) {
  const [rows, setRows] = useState<EmployeeEvaluationRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<CreateEmployeeEvaluationInput>(EMPTY_FORM);
  const [editing, setEditing] = useState<EmployeeEvaluationRecord | null>(null);
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
    setError("");
    try {
      const [evals, emps] = await Promise.all([
        employeeEvaluationApi.list({ limit: 50 }),
        employeeApi.list({ page: 1, limit: 100 }),
      ]);
      setRows(evals.data);
      setEmployees(emps.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const reset = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
  };

  const edit = (row: EmployeeEvaluationRecord) => {
    setEditing(row);
    setForm({
      employeeId: row.employeeId,
      date: row.date.slice(0, 10),
      rating: row.rating,
      comments: row.comments ?? "",
      status: row.status,
    });
  };

  const submit = async () => {
    if (!form.employeeId) {
      notify("error", "Select an employee.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const input: UpdateEmployeeEvaluationInput = {
          rating: form.rating,
          comments: form.comments || null,
          status: form.status,
        };
        await employeeEvaluationApi.update(editing.id, input);
        notify("success", "Evaluation updated.");
      } else {
        await employeeEvaluationApi.create(form);
        notify("success", "Evaluation created.");
      }
      reset();
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: EmployeeEvaluationRecord) => {
    if (!window.confirm(`Delete evaluation for ${row.employee?.name ?? "employee"}?`)) return;
    try {
      await employeeEvaluationApi.remove(row.id);
      notify("success", "Evaluation deleted.");
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
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Employee Evaluation</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">Performance evaluations for employees.</p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h4 className="text-sm font-extrabold">{editing ? "Edit evaluation" : "Add evaluation"}</h4>
          {editing && (
            <button onClick={reset} className="text-xs font-bold text-[var(--muted)] cursor-pointer">
              Cancel
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-3xl">
          <label className="text-xs font-semibold text-[var(--muted)]">Employee *
            <select
              className={`${INPUT} mt-1`}
              value={form.employeeId || ""}
              onChange={(e) => setForm((v) => ({ ...v, employeeId: Number(e.target.value) }))}
            >
              <option value="">— Select —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeCode})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--muted)]">Date *
            <input
              type="date"
              className={`${INPUT} mt-1`}
              value={form.date}
              onChange={(e) => setForm((v) => ({ ...v, date: e.target.value }))}
            />
          </label>
          <label className="text-xs font-semibold text-[var(--muted)]">Rating (0-5)
            <input
              type="number"
              min={0}
              max={5}
              className={`${INPUT} mt-1`}
              value={form.rating ?? 0}
              onChange={(e) => setForm((v) => ({ ...v, rating: Number(e.target.value) }))}
            />
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
          <label className="text-xs font-semibold text-[var(--muted)] sm:col-span-2 lg:col-span-4">
            Comments
            <textarea
              className={`${INPUT} mt-1 min-h-[60px]`}
              rows={2}
              value={form.comments ?? ""}
              onChange={(e) => setForm((v) => ({ ...v, comments: e.target.value }))}
              placeholder="Evaluation comments..."
            />
          </label>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={submit}
            disabled={saving}
            className="h-10 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            {saving ? "Saving…" : editing ? "Save" : "Add evaluation"}
          </button>
          {editing && (
            <button
              onClick={reset}
              className="h-10 rounded-xl px-4 text-xs font-bold border border-[var(--border)] text-[var(--muted)] cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <h4 className="text-sm font-extrabold">Evaluations</h4>
        {error && <p className="text-sm alert-error">{error}</p>}
        {loading ? (
          <p className="text-xs text-[var(--muted)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No evaluations recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Employee</th>
                  <th className="py-3 pr-4">Rating</th>
                  <th className="py-3 pr-4">Comments</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 pr-4 text-[var(--muted)]">{row.date.slice(0, 10)}</td>
                    <td className="py-3 pr-4 font-bold text-[var(--primary-dark)]">
                      {row.employee?.name ?? "—"}
                      <span className="block text-[10px] font-normal text-[var(--muted)]">{row.employee?.employeeCode}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-bold text-[var(--primary-dark)]">{row.rating}/5</span>
                    </td>
                    <td className="py-3 pr-4 text-[var(--muted)] max-w-xs truncate">{row.comments || "—"}</td>
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
