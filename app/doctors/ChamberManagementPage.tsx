// app/doctors/ChamberManagementPage.tsx
// Sub-feature "Chamber Management": CRUD for consultation chambers and their
// weekly doctor time slots. Backed by /api/chambers.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2, FiX, FiClock, FiTrash2 } from "react-icons/fi";
import {
  branchApi,
  chamberApi,
  chamberScheduleApi,
  doctorApi,
  errorMessage,
  type BranchRecord,
  type ChamberRecord,
  type ChamberScheduleRecord,
  type CreateChamberInput,
  type DoctorRecord,
  type PaginationMeta,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";
import { ChamberScheduleModal } from "./ChamberScheduleModal";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChamberRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [scheduleChamber, setScheduleChamber] = useState<ChamberRecord | null>(null);
  const [scheduleRows, setScheduleRows] = useState<ChamberScheduleRecord[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
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
    setDoctorSearch("");
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
    setDoctorSearch(c.doctor?.name ?? "");
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

  const openSchedule = async (chamber: ChamberRecord) => {
    setScheduleChamber(chamber);
    setScheduleLoading(true);
    setScheduleError("");
    try {
      setScheduleRows(await chamberScheduleApi.list(chamber.id));
    } catch (err) {
      setScheduleError(errorMessage(err));
    } finally {
      setScheduleLoading(false);
    }
  };

  const saveSchedule = async () => {
    if (!scheduleChamber) return;
    setScheduleSaving(true);
    setScheduleError("");
    try {
      await chamberScheduleApi.replace(scheduleChamber.id, {
        slots: scheduleRows.map((row) => ({
          doctorId: row.doctorId,
          dayOfWeek: row.dayOfWeek,
          startTime: row.startTime,
          endTime: row.endTime,
        })),
      });
      notify("success", `Schedule for "${scheduleChamber.name}" saved.`);
      setScheduleChamber(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setScheduleError(errorMessage(err));
    } finally {
      setScheduleSaving(false);
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
              {pagination ? `${pagination.total} chamber(s) total` : "Search to view chambers"}
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
              {searchTerm ? "No chambers match your search." : "No chambers have been added yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-[640px] w-full">
              <thead>
                <tr className="bg-[var(--bg)]">
                  {["Name", "Branch", "Doctors", "Actions"].map((col) => (
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
                      {c._count?.schedules ?? 0} scheduled doctor(s)
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openSchedule(c)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary-soft)]/20 text-[var(--primary-dark)] hover:bg-[var(--primary-soft)]/40 transition-colors text-[11px] font-bold"
                          title="Manage weekly schedule"
                        >
                          <FiClock className="w-3.5 h-3.5" /> Schedule
                        </button>
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
                  onChange={(e) => {
                    setForm((f) => ({ ...f, branchId: e.target.value, doctorId: "" }));
                    setDoctorSearch("");
                  }}
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
                <label className={LABEL_CLS}>Legacy doctor assignment</label>
                <input
                  className={INPUT_CLS}
                  value={doctorSearch}
                  onChange={(e) => {
                    setDoctorSearch(e.target.value);
                    setForm((f) => ({ ...f, doctorId: "" }));
                  }}
                  placeholder="Search name, ID, or phone number"
                  disabled={saving}
                />
                {doctorSearch.trim() && (
                  <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1.5 space-y-1">
                    {doctors
                      .filter((d) => !form.branchId || d.branchId === Number(form.branchId))
                      .filter((d) => `${d.name} ${d.doctorCode} ${d.phone ?? ""} ${d.specialization ?? ""}`.toLowerCase().includes(doctorSearch.trim().toLowerCase()))
                      .map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, doctorId: String(d.id) }));
                            setDoctorSearch(d.name);
                          }}
                          className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                            form.doctorId === String(d.id)
                              ? "bg-[var(--primary)]/10 text-[var(--primary-dark)]"
                              : "hover:bg-[var(--primary-soft)]/20 text-[var(--text)]"
                          }`}
                        >
                          <span className="font-bold">{d.name}</span>
                          <span className="block text-[10px] text-[var(--muted)]">{d.doctorCode}{d.specialization ? ` · ${d.specialization}` : ""}</span>
                        </button>
                      ))}
                    {doctors
                      .filter((d) => !form.branchId || d.branchId === Number(form.branchId))
                      .filter((d) => `${d.name} ${d.doctorCode} ${d.phone ?? ""} ${d.specialization ?? ""}`.toLowerCase().includes(doctorSearch.trim().toLowerCase()))
                      .length === 0 && (
                      <p className="px-2.5 py-2 text-[11px] font-semibold text-[var(--muted)]">No doctors found.</p>
                    )}

                    {false && scheduleChamber && (
                      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6" onClick={() => !scheduleSaving && setScheduleChamber(null)}>
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                        <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                              <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Weekly recurring schedule</span>
                              <h3 className="font-black text-xl text-[var(--primary-dark)]">{scheduleChamber!.name}</h3>
                            </div>
                            <button onClick={() => setScheduleChamber(null)} disabled={scheduleSaving} className="p-2 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)]"><FiX /></button>
                          </div>
                          {scheduleError && <p className="alert-error text-xs mb-3">{scheduleError}</p>}
                          {scheduleLoading ? (
                            <div className="py-10 text-center text-xs text-[var(--muted)]">Loading schedule…</div>
                          ) : (
                            <>
                              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                                <table className="min-w-[760px] w-full">
                                  <thead><tr className="bg-[var(--bg)]">{["Doctor", "Day", "Start", "End", ""].map((label) => <th key={label} className="text-left text-[11px] font-bold text-[var(--muted)] px-3 py-2 border-b border-[var(--border)]">{label}</th>)}</tr></thead>
                                  <tbody>
                                    {scheduleRows.map((row, index) => (
                                      <tr key={row.id} className="border-b border-[var(--border)]">
                                        <td className="px-3 py-2"><select className={INPUT_CLS} value={row.doctorId} onChange={(e) => setScheduleRows((prev) => prev.map((item, i) => i === index ? { ...item, doctorId: Number(e.target.value) } : item))}>{doctors.filter((doctor) => doctor.branchId === scheduleChamber!.branchId).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} ({doctor.doctorCode})</option>)}</select></td>
                                        <td className="px-3 py-2"><select className={INPUT_CLS} value={row.dayOfWeek} onChange={(e) => setScheduleRows((prev) => prev.map((item, i) => i === index ? { ...item, dayOfWeek: Number(e.target.value) } : item))}>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, value) => <option key={day} value={value}>{day}</option>)}</select></td>
                                        <td className="px-3 py-2"><input type="time" className={INPUT_CLS} value={row.startTime} onChange={(e) => setScheduleRows((prev) => prev.map((item, i) => i === index ? { ...item, startTime: e.target.value } : item))} /></td>
                                        <td className="px-3 py-2"><input type="time" className={INPUT_CLS} value={row.endTime} onChange={(e) => setScheduleRows((prev) => prev.map((item, i) => i === index ? { ...item, endTime: e.target.value } : item))} /></td>
                                        <td className="px-3 py-2"><button onClick={() => setScheduleRows((prev) => prev.filter((_, i) => i !== index))} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg" title="Remove slot"><FiTrash2 /></button></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="flex items-center justify-between gap-3 mt-4">
                                <button
                                  onClick={() => {
                                    const chamberDoctors = doctors.filter((doctor) => doctor.branchId === scheduleChamber!.branchId);
                                    if (chamberDoctors.length === 0) return;
                                    setScheduleRows((prev) => [...prev, { id: -Date.now(), chamberId: scheduleChamber!.id, branchId: scheduleChamber!.branchId, doctorId: chamberDoctors[0].id, dayOfWeek: 0, startTime: "09:00", endTime: "17:00", status: "active", doctor: { id: chamberDoctors[0].id, name: chamberDoctors[0].name, doctorCode: chamberDoctors[0].doctorCode } }]);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-[var(--bg)]"
                                ><FiPlus /> Add doctor slot</button>
                                <button onClick={saveSchedule} disabled={scheduleSaving} className="px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>{scheduleSaving ? "Saving…" : "Save schedule"}</button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!doctorSearch && (
                  <p className="mt-1 text-[10px] font-semibold text-[var(--muted)]">Leave blank for unassigned.</p>
                )}
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

      {scheduleChamber && (
        <ChamberScheduleModal
          chamber={scheduleChamber}
          rows={scheduleRows}
          doctors={doctors}
          loading={scheduleLoading}
          saving={scheduleSaving}
          error={scheduleError}
          onRowsChange={setScheduleRows}
          onSave={saveSchedule}
          onClose={() => setScheduleChamber(null)}
        />
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
