// app/nurses/NurseModule.tsx
// Live "Nursing Management" module (feature id = 13 in the dashboard).
// Lists nurses from GET /api/nurses with server-side pagination and search,
// and drives the create/edit flows. Nurses are first-class records with their
// own branch-scoped NUR- code, so this replaces the previous static table.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2 } from "react-icons/fi";
import {
  departmentApi,
  nurseApi,
  type ActiveStatus,
  type CreateNurseInput,
  type DepartmentRecord,
  type NurseRecord,
  type PaginationMeta,
  type ShiftTypeRecord,
  errorMessage,
  NotFoundError,
  ValidationError,
} from "@/app/lib/api";
import {
  addError,
  checkEmail,
  checkName,
  checkOptionalId,
  checkPhone,
  checkText,
  REGISTRATION_NO_MAX,
  SHORT_TEXT_MAX,
} from "@/app/lib/formValidation";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const PAGE_SIZE = 10;

const sanitizePhone = (v: string) => v.replace(/[^0-9+\-\s()]/g, "");

const STATUS_STYLES: Record<ActiveStatus, string> = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
};

export function NurseModule() {
  const [rows, setRows] = useState<NurseRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [formMode, setFormMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<NurseRecord | null>(null);
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
      const result = await nurseApi.list({
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

  const submit = async (input: CreateNurseInput): Promise<void> => {
    if (editing) {
      await nurseApi.update(editing.id, input);
      notify("success", `Nurse "${input.name}" updated.`);
    } else {
      const created = await nurseApi.create(input);
      notify("success", `Nurse "${input.name}" created. Code: ${created.nurse.nurseCode}.`);
      setPage(1);
      setSearchTerm("");
      setSearchInput("");
    }
    setFormMode("list");
    setEditing(null);
    setReloadKey((k) => k + 1);
  };

  if (formMode === "form") {
    return (
      <div className="space-y-6">
        <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
            Nursing Management
          </span>
          <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{editing ? "Edit Nurse" : "Add Nurse"}</h3>
          <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
            {editing
              ? "Update the nurse profile, department and shift assignment."
              : "Register a new nurse; a login account is created with the password."}
          </p>
        </div>

        <button
          onClick={() => { setFormMode("list"); setEditing(null); }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors cursor-pointer"
        >
          <span>{"\u2190"} Back to Nurses</span>
        </button>

        <NurseFormPage
          key={editing?.id ?? "new"}
          nurse={editing}
          onSubmit={submit}
          onCancel={() => { setFormMode("list"); setEditing(null); }}
        />

        <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Nursing Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Nurses</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: nurse profiles, registration numbers, department and shift.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Nurses</h4>
            <p className="text-xs text-[var(--muted)]">
              {pagination ? `${pagination.total} nurse(s) total` : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, ID, registration…"
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
              onClick={() => { setEditing(null); setFormMode("form"); }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98]"
              style={{ background: "var(--primary)" }}
            >
              <FiPlus className="w-3.5 h-3.5" />
              Add Nurse
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[900px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                {["ID", "Name", "Qualification", "Registration No.", "Department", "Shift", "Phone", "Status", "Actions"].map((col) => (
                  <th key={col} className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-xs text-[var(--muted)]">No nurses found.</td></tr>
              ) : (
                rows.map((n) => (
                  <tr key={n.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="text-[12px] font-bold text-[var(--primary-dark)] px-4 py-3 border-b border-[var(--border)]">{n.nurseCode}</td>
                    <td className="text-[12px] font-bold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{n.name}</td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{n.qualification ?? "—"}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{n.registrationNo ?? "—"}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{n.department?.name ?? "—"}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{n.shiftType?.name ?? "—"}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{n.phone ?? "—"}</td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span className={`inline-block text-[10px] font-bold capitalize px-2 py-0.5 rounded-md border ${STATUS_STYLES[n.status]}`}>{n.status}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <button
                        onClick={() => { setEditing(n); setFormMode("form"); }}
                        className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                        title="Edit nurse"
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

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function NurseFormPage({
  nurse,
  onSubmit,
  onCancel,
}: {
  nurse: NurseRecord | null;
  onSubmit: (input: CreateNurseInput) => Promise<void>;
  onCancel: () => void;
}) {
  const editing = !!nurse;
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeRecord[]>([]);
  const [name, setName] = useState(nurse?.name ?? "");
  const [departmentId, setDepartmentId] = useState<string>(nurse?.departmentId ? String(nurse.departmentId) : "");
  const [shiftTypeId, setShiftTypeId] = useState<string>(nurse?.shiftTypeId ? String(nurse.shiftTypeId) : "");
  const [qualification, setQualification] = useState(nurse?.qualification ?? "");
  const [registrationNo, setRegistrationNo] = useState(nurse?.registrationNo ?? "");
  const [phone, setPhone] = useState(nurse?.phone ?? "");
  const [email, setEmail] = useState(nurse?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<ActiveStatus>(nurse?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const INPUT_CLS =
    "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

  const setField = (key: string, value: string) => {
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
    return value;
  };

  const fieldError = (key: string) =>
    fieldErrors[key] ? (
      <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors[key]}</p>
    ) : null;

  useEffect(() => {
    let active = true;
    departmentApi.list({ limit: 100 })
      .then((r) => { if (active) setDepartments(r.data); })
      .catch(() => {});
    // Shift types are reference data; the roster still loads without them, so a
    // failure here only empties that one dropdown.
    nurseApi.shiftTypes()
      .then((r) => { if (active) setShiftTypes(r.shiftTypes); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Mirrors the backend Zod rules so an obviously bad value is caught before a
  // round trip; the server still has the final say.
  const validate = (): boolean => {
      const next: Record<string, string> = {};
      addError(next, "name", checkName(name));
      addError(next, "email", checkEmail(email));
      addError(next, "phone", checkPhone(phone));
      addError(next, "departmentId", checkOptionalId(departmentId, "department"));
      addError(next, "shiftTypeId", checkOptionalId(shiftTypeId, "shift"));
      addError(next, "qualification", checkText(qualification, SHORT_TEXT_MAX, "Qualification"));
      addError(next, "registrationNo", checkText(registrationNo, REGISTRATION_NO_MAX, "Registration number"));
      if (!editing) {
        if (!password.trim()) {
          addError(next, "password", "Password is required to create a login account");
        } else {
          if (password.length < 8) {
            addError(next, "password", "Password must be at least 8 characters");
          }
          if (confirmPassword !== password) {
            addError(next, "confirmPassword", "Passwords do not match");
          }
        }
        if (!email.trim()) {
          addError(next, "email", "Email is required to create a login account");
        }
      }
      setFieldErrors(next);
      return Object.keys(next).length === 0;
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        departmentId: departmentId ? Number(departmentId) : null,
        shiftTypeId: shiftTypeId ? Number(shiftTypeId) : null,
        qualification: qualification.trim() || null,
        registrationNo: registrationNo.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        ...(!editing
          ? { password: password.trim(), confirmPassword: confirmPassword.trim() || password.trim() }
          : {}),
        status,
      });
    } catch (err) {
      // Per-field messages from the server are shown next to the input that
      // caused them instead of a single opaque banner.
      if (err instanceof ValidationError) {
        setFieldErrors(err.fieldErrors ?? {});
        setError("Please correct the highlighted fields.");
      } else if (err instanceof NotFoundError) {
        // Reference checks (branch / department / shift) land on the related select.
        const key = /department/i.test(err.message)
          ? "departmentId"
          : /shift/i.test(err.message)
            ? "shiftTypeId"
            : "";
        if (key) setFieldErrors({ [key]: err.message });
        setError("Please correct the highlighted fields.");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}
      className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm w-full p-6 sm:p-8">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Nursing</span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{editing ? "Edit Nurse" : "Add Nurse"}</h3>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(setField("name", e.target.value))} className={INPUT_CLS} />
            {fieldError("name")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Registration No.</label>
            <input value={registrationNo} onChange={(e) => setRegistrationNo(setField("registrationNo", e.target.value))} className={INPUT_CLS} />
            {fieldError("registrationNo")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Qualification</label>
            <input value={qualification} onChange={(e) => setQualification(setField("qualification", e.target.value))} className={INPUT_CLS} />
            {fieldError("qualification")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Department</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={INPUT_CLS}>
              <option value="">— None —</option>
              {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </select>
            {fieldError("departmentId")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Shift</label>
            <select value={shiftTypeId} onChange={(e) => setShiftTypeId(e.target.value)} className={INPUT_CLS}>
              <option value="">— None —</option>
              {shiftTypes.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
            {fieldError("shiftTypeId")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Phone</label>
              <input value={phone} inputMode="tel" onChange={(e) => setPhone(setField("phone", sanitizePhone(e.target.value)))} className={INPUT_CLS} />
            {fieldError("phone")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">{editing ? "Email" : "Email *"}</label>
            <input type="email" value={email} onChange={(e) => setEmail(setField("email", e.target.value))} className={INPUT_CLS} />
            {fieldError("email")}
          </div>
          {!editing && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Password * (creates login)</label>
                <input type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(setField("password", e.target.value))} className={INPUT_CLS} />
                <p className="text-[10px] text-[var(--muted)] mt-1">A login account is created for every nurse.</p>
                {fieldError("password")}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Confirm Password *</label>
                <input type="password" autoComplete="new-password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(setField("confirmPassword", e.target.value))} className={INPUT_CLS} />
                {fieldError("confirmPassword")}
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ActiveStatus)} className={INPUT_CLS}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {fieldError("status")}
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <button type="submit" disabled={saving}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            style={{ background: "var(--primary)" }}>
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Nurse"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}
            className="px-4 py-3 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            Cancel
          </button>
        </div>
      </form>
  );
}
