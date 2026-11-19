"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiRefreshCcw, FiEdit2, FiCheck, FiX } from "react-icons/fi";
import { employeeApi, errorMessage, type EmployeeRecord } from "@/app/lib/api";
import { ToastViewport, type ToastItem } from "@/app/patients/Toast";

export function PayrollManagementPage({ onBack }: { onBack?: () => void }) {
  const [rows, setRows] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [salaryInput, setSalaryInput] = useState("");
  const [saving, setSaving] = useState(false);

  const notify = useCallback((kind: ToastItem["kind"], message: string) => {
    toastId.current += 1;
    setToasts((prev) => [...prev.slice(-3), { id: toastId.current, kind, message }]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await employeeApi.list({ page: 1, limit: 100 });
      setRows(result.data);
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

  const totalSalary = rows.reduce((sum, r) => sum + (Number(r.basicSalary) || 0), 0);

  const startEdit = (row: EmployeeRecord) => {
    setEditingId(row.id);
    setSalaryInput(row.basicSalary != null ? String(row.basicSalary) : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSalaryInput("");
  };

  const saveSalary = async (row: EmployeeRecord) => {
    const value = salaryInput.trim() === "" ? null : Number(salaryInput);
    if (value !== null && (isNaN(value) || value < 0)) {
      notify("error", "Enter a valid salary.");
      return;
    }
    setSaving(true);
    try {
      await employeeApi.update(row.id, { basicSalary: value !== null ? String(value) : null });
      notify("success", `Salary updated for ${row.name}.`);
      setEditingId(null);
      setSalaryInput("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSaving(false);
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
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Payroll Management</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">
          Employee payroll overview. Edit basic salary per employee.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Employees</div>
          <div className="text-2xl font-black mt-1 text-[var(--primary-dark)]">{rows.length}</div>
        </div>
        <div className="card p-4 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Total basic salary</div>
          <div className="text-2xl font-black mt-1 text-[var(--primary-dark)]">
            {totalSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="card p-4 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Avg. salary</div>
          <div className="text-2xl font-black mt-1 text-[var(--primary-dark)]">
            {rows.length ? (totalSalary / rows.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
          </div>
        </div>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        {error && <p className="text-sm alert-error">{error}</p>}
        {loading ? (
          <p className="text-xs text-[var(--muted)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No employees found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-3 pr-4">Emp ID</th>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Designation</th>
                  <th className="py-3 pr-4">Department</th>
                  <th className="py-3 pr-4 text-right">Basic Salary</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 pr-4 font-bold text-[var(--primary-dark)]">{row.employeeCode}</td>
                    <td className="py-3 pr-4">{row.name}</td>
                    <td className="py-3 pr-4 text-[var(--muted)]">{row.designation?.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-[var(--muted)]">{row.department?.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-right">
                      {editingId === row.id ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={salaryInput}
                          onChange={(e) => setSalaryInput(e.target.value)}
                          className="h-9 w-28 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-2 text-xs font-semibold text-right"
                        />
                      ) : (
                        <span className="font-bold text-[var(--primary-dark)]">
                          {row.basicSalary != null
                            ? Number(row.basicSalary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : "—"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {editingId === row.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => saveSalary(row)}
                            disabled={saving}
                            className="p-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-60"
                            title="Save"
                          >
                            <FiCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                            title="Cancel"
                          >
                            <FiX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(row)}
                          className="inline-flex items-center gap-1 text-[var(--primary)] font-bold cursor-pointer"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
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
