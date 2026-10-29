// app/doctors/DepartmentAssignmentPage.tsx
// Sub-feature "Department Assignment" (Doctor Management): one row per doctor
// with an inline department dropdown. Changing the dropdown saves immediately
// through PATCH /api/doctors/:id, so there is no separate save step.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiRefreshCcw, FiSearch } from "react-icons/fi";
import {
  departmentApi,
  doctorApi,
  errorMessage,
  type ActiveStatus,
  type DepartmentRecord,
  type DoctorRecord,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<ActiveStatus, string> = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
};

const LABEL_CLS =
  "block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1";

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function DepartmentAssignmentPage() {
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [page, setPage] = useState(1);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // The whole doctor list is loaded once (100 per request, capped at 10 pages)
  // because the counters and the "Unassigned" filter need the full picture,
  // and the API has no "department is empty" filter.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deptResult, firstPage] = await Promise.all([
        departmentApi.list({ limit: 100 }),
        doctorApi.list({ page: 1, limit: 100 }),
      ]);
      let all = firstPage.data;
      const totalPages = Math.min(firstPage.pagination?.totalPages ?? 1, 10);
      for (let p = 2; p <= totalPages; p += 1) {
        const next = await doctorApi.list({ page: p, limit: 100 });
        all = all.concat(next.data);
      }
      setDepartments([...deptResult.data].sort((a, b) => a.name.localeCompare(b.name)));
      setDoctors(all);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load, reload]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return doctors.filter((d) => {
      if (departmentFilter === "unassigned") {
        if (d.departmentId != null) return false;
      } else if (departmentFilter) {
        if (d.departmentId !== Number(departmentFilter)) return false;
      }
      if (!q) return true;
      return [
        d.name,
        d.doctorCode,
        d.specialization ?? "",
        d.phone ?? "",
        d.department?.name ?? "",
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [doctors, searchTerm, departmentFilter]);

  const total = doctors.length;
  const assigned = doctors.filter((d) => d.departmentId != null).length;
  const filtersActive = searchTerm !== "" || departmentFilter !== "";

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const assign = async (doctor: DoctorRecord, value: string) => {
    const nextId = value ? Number(value) : null;
    if ((doctor.departmentId ?? null) === nextId) return;
    setSavingId(doctor.id);
    try {
      const result = await doctorApi.update(doctor.id, { departmentId: nextId });
      const match = departments.find((d) => d.id === nextId) ?? null;
      const department =
        result.doctor.department ??
        (match ? { id: match.id, name: match.name, code: match.code } : null);
      setDoctors((prev) =>
        prev.map((d) =>
          d.id === doctor.id ? { ...d, departmentId: nextId, department } : d,
        ),
      );
      notify(
        "success",
        nextId
          ? `${doctor.name} assigned to ${department?.name ?? "the department"}.`
          : `${doctor.name} is no longer assigned to a department.`,
      );
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Doctor Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
          Department Assignment
        </h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Give every doctor a department. Picking a value in the table saves straight away — no
          separate save step.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 min-w-[5.5rem]">
              <p className="text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)]">
                Doctors
              </p>
              <p className="text-sm font-black text-[var(--text)]">{total}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 min-w-[5.5rem]">
              <p className="text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)]">
                Assigned
              </p>
              <p className="text-sm font-black text-emerald-600">{assigned}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 min-w-[5.5rem]">
              <p className="text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)]">
                Unassigned
              </p>
              <p className={`text-sm font-black ${total - assigned > 0 ? "text-amber-600" : "text-[var(--text)]"}`}>
                {total - assigned}
              </p>
            </div>
          </div>

          <button
            onClick={() => setReload((t) => t + 1)}
            title="Refresh"
            className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            <FiRefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,20rem)_14rem_auto] gap-3 items-end">
          <div>
            <label htmlFor="da-search" className={LABEL_CLS}>
              Search doctors
            </label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]" />
              <input
                id="da-search"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, doctor ID, specialty or phone…"
                className={`${INPUT_CLS} pl-9`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="da-department" className={LABEL_CLS}>
              Department
            </label>
            <select
              id="da-department"
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              className={`${INPUT_CLS} h-[34px]`}
            >
              <option value="">All departments</option>
              <option value="unassigned">Unassigned</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {filtersActive && (
            <button
              onClick={() => {
                setSearchInput("");
                setSearchTerm("");
                setDepartmentFilter("");
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer h-[34px] w-fit"
            >
              Clear filters
            </button>
          )}
        </div>

        {error && (
          <div className="alert-error text-xs flex items-center justify-between">
            {error}
            <button
              onClick={() => setReload((t) => t + 1)}
              className="text-xs font-bold underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loading && doctors.length === 0 ? (
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
            <p className="text-xs font-bold text-[var(--muted)] mt-3">Loading doctors…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
            <FiAlertCircle className="w-6 h-6 mx-auto mb-2 text-[var(--muted)] opacity-50" />
            <p className="text-xs font-bold text-[var(--muted)]">
              {filtersActive
                ? "No doctors match these filters."
                : "No doctors registered yet. Add one from Doctor Profile Management."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-[820px] w-full">
              <thead>
                <tr className="bg-[var(--bg)]">
                  {["Doctor", "Specialty", "Phone", "Department", "Status"].map((col) => (
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
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <p className="text-[12px] font-bold text-[var(--text)]">{d.name}</p>
                      <p className="text-[10px] font-bold text-[var(--primary-dark)]">
                        {d.doctorCode}
                      </p>
                    </td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {d.specialization ?? "—"}
                    </td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                      {d.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-2">
                        <select
                          value={d.departmentId ?? ""}
                          onChange={(e) => assign(d, e.target.value)}
                          disabled={savingId === d.id}
                          aria-label={`Department for ${d.name}`}
                          className={`bg-[var(--bg)] border rounded-xl px-2.5 py-1.5 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-[var(--primary)]/15 max-w-[15rem] disabled:opacity-60 ${
                            d.departmentId == null
                              ? "border-amber-300 text-amber-700"
                              : "border-[var(--border)] text-[var(--text)]"
                          }`}
                        >
                          <option value="">Unassigned</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                              {dept.status === "inactive" ? " (inactive)" : ""}
                            </option>
                          ))}
                        </select>
                        {savingId === d.id && (
                          <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[var(--primary)]" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span
                        className={`inline-block text-[10px] font-bold capitalize px-2 py-0.5 rounded-md border ${STATUS_STYLES[d.status]}`}
                      >
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs text-[var(--muted)]">
              Showing {rows.length} of {filtered.length} doctor(s)
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${safePage <= 1 ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed" : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"}`}
                >
                  Previous
                </button>
                <span className="text-xs font-bold text-[var(--muted)]">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${safePage >= totalPages ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed" : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"}`}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
