// app/doctors/ChamberManagementPage.tsx
// Sub-feature "Chamber Management": CRUD for consultation chambers, with an
// optional doctor assignment. Backed by /api/chambers.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2, FiX } from "react-icons/fi";
import {
  branchApi,
  chamberApi,
  doctorApi,
  errorMessage,
  type BranchRecord,
  type ChamberRecord,
  type CreateChamberInput,
  type DoctorRecord,
  type PaginationMeta,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const PAGE_SIZE = 10;

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

const LABEL_CLS = "block text-xs font-semibold text-[var(--muted)] mb-1";

interface FormState {
  name: string;
  branchId: string;
  description: string;
  doctorId: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  branchId: "",
  description: "",
  doctorId: "",
};

export function ChamberManagementPage() {
  const [rows, setRows] = useState<ChamberRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChamberRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    try {
      const result = await chamberApi.list({
        page,
        limit: PAGE_SIZE,
        search: searchTerm || undefined,
      });
      setRows(result.data);
      setPagination(result.pagination);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    doctorApi
      .list({ page: 1, limit: 100 })
      .then((r) => setDoctors([...r.data].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
    branchApi
      .list({ limit: 100 })
      .then((r) => setBranches([...r.data].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, []);

  const totalPages = pagination?.totalPages ?? 1;
  const safePage = Math.min(page, Math.max(1, totalPages));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, branchId: branches.length === 1 ? String(branches[0].id) : "" });
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (c: ChamberRecord) => {
    setEditing(c);
    setForm({
      name: c.name,
      branchId: String(c.branchId),
      description: c.description ?? "",
      doctorId: c.doctorId ? String(c.doctorId) : "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!form.branchId) {
      setFormError("Branch is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const input: CreateChamberInput = {
        name: form.name.trim(),
        branchId: Number(form.branchId),
        description: form.description.trim() || undefined,
        doctorId: form.doctorId ? Number(form.doctorId) : null,
      };
      if (editing) {
        await chamberApi.update(editing.id, input);
        notify("success", `Chamber "${input.name}" updated.`);
      } else {
        await chamberApi.create(input);
        notify("success", `Chamber "${input.name}" created.`);
      }
      setFormOpen(false);
      setEditing(null);
      setPage(1);
      setSearchTerm("");
      setSearchInput("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: ChamberRecord) => {
    if (!window.confirm(`Delete chamber "${c.name}"?`)) return;
    try {
      await chamberApi.remove(c.id);
      notify("success", `Chamber "${c.name}" deleted.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Doctor Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Chamber Management</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Consultation chambers and the doctors assigned to them. Each chamber belongs to a branch.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Chambers</h4>
            <p className="text-xs text-[var(--muted)]">
              {pagination ? `${pagination.total} chamber(s) total` : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, code, location…"
                className="pl-9 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 w-64 max-w-full"
              />
            </div>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="p-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              title="Refresh"
            >
              <FiRefreshCcw className="w-4 h-4" />
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98]"
              style={{ background: "var(--primary)" }}
            >
              <FiPlus className="w-3.5 h-3.5" />
              Add Chamber
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
            <p className="text-xs font-bold text-[var(--muted)]">
              {searchTerm ? "No chambers match your search." : "No chambers registered yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-[640px] w-full">
              <thead>
                <tr className="bg-[var(--bg)]">
                  {["Name", "Branch", "Assigned Doctor", "Actions"].map((col) => (
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
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="text-[12px] font-bold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {c.name}
                      <span className="block text-[10px] text-[var(--muted)]">{c.code}</span>
                    </td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {c.branch?.name ?? "—"}
                      {c.branch?.city ? (
                        <span className="block text-[10px] text-[var(--muted)]">{c.branch.city}</span>
                      ) : null}
                    </td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {c.doctor?.name ?? "Unassigned"}
                      {c.doctor?.doctorCode ? (
                        <span className="block text-[10px] text-[var(--muted)]">{c.doctor.doctorCode}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                          title="Edit chamber"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => remove(c)}
                          className="p-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                          title="Delete chamber"
                        >
                          <FiX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs text-[var(--muted)]">
              Showing {rows.length} of {pagination?.total ?? 0} rows
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

      {formOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
          onClick={() => !saving && closeForm()}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] overflow-y-auto p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <FiX className="w-4 h-4" />
            </button>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
              Doctor Management
            </span>
            <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
              {editing ? "Edit Chamber" : "Add Chamber"}
            </h3>

            {formError && <div className="mt-4 alert-error text-xs">{formError}</div>}

            <div className="mt-5 space-y-4">
              <div>
                <label className={LABEL_CLS}>Name *</label>
                <input
                  className={INPUT_CLS}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Branch (location) *</label>
                <select
                  className={INPUT_CLS}
                  value={form.branchId}
                  onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value, doctorId: "" }))}
                  disabled={saving}
                >
                  <option value="">Select branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.city ?? b.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Description</label>
                <textarea
                  rows={2}
                  className={`${INPUT_CLS} resize-none`}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Assigned doctor</label>
                <select
                  className={INPUT_CLS}
                  value={form.doctorId}
                  onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
                  disabled={saving}
                >
                  <option value="">Unassigned</option>
                  {doctors
                    .filter((d) => !form.branchId || d.branchId === Number(form.branchId))
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.doctorCode})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="px-4 py-2.5 bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] rounded-xl text-xs font-bold transition-colors disabled:opacity-60 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                style={{ background: "var(--primary)" }}
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Create chamber"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
