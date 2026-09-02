// app/dashboard/settings/doctors/DoctorsView.tsx
// Live "Doctors" page backed by GET/POST/PATCH /api/doctors.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2 } from "react-icons/fi";
import {
  departmentApi,
  doctorApi,
  type ActiveStatus,
  type CreateDoctorInput,
  type DepartmentRecord,
  type DoctorRecord,
  type PaginationMeta,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<ActiveStatus, string> = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
};

export function DoctorsView() {
  const [rows, setRows] = useState<DoctorRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DoctorRecord | null>(null);
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
      const result = await doctorApi.list({
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

  const totalPages = pagination?.totalPages ?? 1;
  const safePage = Math.min(page, Math.max(1, totalPages));

  const submit = async (input: CreateDoctorInput) => {
    if (editing) {
      await doctorApi.update(editing.id, input);
      notify("success", `Doctor "${input.name}" updated.`);
    } else {
      await doctorApi.create(input);
      notify("success", `Doctor "${input.name}" created.`);
    }
    setFormOpen(false);
    setEditing(null);
    setPage(1);
    setSearchTerm("");
    setSearchInput("");
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Doctors</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: doctor profiles, specialization and consultation fees.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Doctors</h4>
            <p className="text-xs text-[var(--muted)]">
              {pagination ? `${pagination.total} doctor(s) total` : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, ID, specialty…"
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
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98]"
              style={{ background: "var(--primary)" }}
            >
              <FiPlus className="w-3.5 h-3.5" />
              Add Doctor
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[950px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                {["ID", "Name", "Specialty", "Department", "Consultation Fee", "Phone", "Status", "Actions"].map((col) => (
                  <th key={col} className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-[var(--muted)]">No doctors found.</td></tr>
              ) : (
                rows.map((d) => (
                  <tr key={d.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="text-[12px] font-bold text-[var(--primary-dark)] px-4 py-3 border-b border-[var(--border)]">{d.doctorCode}</td>
                    <td className="text-[12px] font-bold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{d.name}</td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{d.specialization ?? "—"}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{d.department?.name ?? "—"}</td>
                    <td className="text-[12px] font-semibold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{d.consultationFee ?? "—"}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{d.phone ?? "—"}</td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span className={`inline-block text-[10px] font-bold capitalize px-2 py-0.5 rounded-md border ${STATUS_STYLES[d.status]}`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <button
                        onClick={() => { setEditing(d); setFormOpen(true); }}
                        className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                        title="Edit doctor"
                      >
                        <FiEdit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-[var(--muted)]">Showing {rows.length} of {pagination?.total ?? 0} rows</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${safePage <= 1 ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed" : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"}`}>
              Previous
            </button>
            <span className="text-xs font-bold text-[var(--muted)]">Page {safePage} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${safePage >= totalPages ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed" : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"}`}>
              Next
            </button>
          </div>
        </div>
      </div>

      {formOpen && (
        <DoctorFormModal
          key={editing?.id ?? "new"}
          doctor={editing}
          onSubmit={submit}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function DoctorFormModal({
  doctor,
  onSubmit,
  onClose,
}: {
  doctor: DoctorRecord | null;
  onSubmit: (input: CreateDoctorInput) => Promise<void>;
  onClose: () => void;
}) {
  const editing = !!doctor;
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [doctorCode, setDoctorCode] = useState(doctor?.doctorCode ?? "");
  const [name, setName] = useState(doctor?.name ?? "");
  const [departmentId, setDepartmentId] = useState<string>(doctor?.departmentId ? String(doctor.departmentId) : "");
  const [specialization, setSpecialization] = useState(doctor?.specialization ?? "");
  const [qualification, setQualification] = useState(doctor?.qualification ?? "");
  const [registrationNo, setRegistrationNo] = useState(doctor?.registrationNo ?? "");
  const [phone, setPhone] = useState(doctor?.phone ?? "");
  const [email, setEmail] = useState(doctor?.email ?? "");
  const [consultationFee, setConsultationFee] = useState(doctor?.consultationFee ?? "");
  const [followupFee, setFollowupFee] = useState(doctor?.followupFee ?? "");
  const [emergencyFee, setEmergencyFee] = useState(doctor?.emergencyFee ?? "");
  const [status, setStatus] = useState<ActiveStatus>(doctor?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const INPUT_CLS =
    "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

  useEffect(() => {
    let active = true;
    departmentApi.list({ limit: 100 })
      .then((r) => { if (active) setDepartments(r.data); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || (!editing && !doctorCode.trim())) {
      setError(editing ? "Doctor name is required." : "Doctor name and code are required.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        doctorCode: doctorCode.trim(),
        name: name.trim(),
        departmentId: departmentId ? Number(departmentId) : null,
        specialization: specialization.trim() || null,
        qualification: qualification.trim() || null,
        registrationNo: registrationNo.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        consultationFee: consultationFee.trim() || null,
        followupFee: followupFee.trim() || null,
        emergencyFee: emergencyFee.trim() || null,
        status,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}
        className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 animate-[scaleIn_0.25s_ease-out]">
        <button type="button" onClick={onClose} disabled={saving} className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors disabled:opacity-50" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Doctors</span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{editing ? "Edit Doctor" : "Add Doctor"}</h3>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Doctor Code *</label>
            <input value={doctorCode} onChange={(e) => setDoctorCode(e.target.value)} disabled={editing} className={`${INPUT_CLS} ${editing ? "opacity-50" : ""}`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Department</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={INPUT_CLS}>
              <option value="">— None —</option>
              {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Specialization</label>
            <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Qualification</label>
            <input value={qualification} onChange={(e) => setQualification(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Registration No.</label>
            <input value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Consultation Fee</label>
            <input value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Follow-up Fee</label>
            <input value={followupFee} onChange={(e) => setFollowupFee(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Emergency Fee</label>
            <input value={emergencyFee} onChange={(e) => setEmergencyFee(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ActiveStatus)} className={INPUT_CLS}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <button type="submit" disabled={saving}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            style={{ background: "var(--primary)" }}>
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Doctor"}
          </button>
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-3 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}