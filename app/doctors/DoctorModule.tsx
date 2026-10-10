// app/doctors/DoctorModule.tsx
// Live "Doctor Management" module (feature id = 2 in the dashboard).
// Lists doctors from GET /api/doctors with server-side pagination,
// search, and drives the create/edit flows.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2, FiEye, FiUserCheck, FiUserX } from "react-icons/fi";
import {
  departmentApi,
  doctorApi,
  type ActiveStatus,
  type CreateDoctorInput,
  type DepartmentRecord,
  type DoctorRecord,
  type   PaginationMeta,
  errorMessage,
  NotFoundError,
  ValidationError,
} from "@/app/lib/api";
import {
  addError,
  checkEmail,
  checkMoney,
  checkName,
  checkOptionalId,
  checkPhone,
  checkText,
  REGISTRATION_NO_MAX,
  SHORT_TEXT_MAX,
} from "@/app/lib/formValidation";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";
import { useCurrency } from "@/app/hooks/useCurrency";
import { formatCurrency } from "@/app/lib/currency";

const PAGE_SIZE = 10;

const sanitizePhone = (v: string) => v.replace(/[^0-9+\-\s()]/g, "");
const sanitizeMoney = (v: string) => {
  let s = v.replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
    s = s.slice(0, dot + 3);
  }
  return s;
};

const STATUS_STYLES: Record<ActiveStatus, string> = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
};

export function DoctorModule() {
  const { currency } = useCurrency();
  const [rows, setRows] = useState<DoctorRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [formMode, setFormMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<DoctorRecord | null>(null);
  const [viewing, setViewing] = useState<DoctorRecord | null>(null);
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

  const submit = async (input: CreateDoctorInput): Promise<void> => {
    if (editing) {
      await doctorApi.update(editing.id, input);
      notify("success", `Doctor "${input.name}" updated.`);
    } else {
      const created = await doctorApi.create(input);
      notify("success", `Doctor "${input.name}" created. Code: ${created.doctor.doctorCode}.`);
      setPage(1);
      setSearchTerm("");
      setSearchInput("");
    }
    setFormMode("list");
    setEditing(null);
    setReloadKey((k) => k + 1);
  };

  const toggleStatus = async (d: DoctorRecord) => {
    const next = d.status === "active" ? "inactive" : "active";
    try {
      await doctorApi.update(d.id, { status: next });
      notify("success", `Doctor "${d.name}" ${next === "active" ? "activated" : "deactivated"}.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    }
  };

  if (formMode === "form") {
    return (
      <div className="space-y-6">
        <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
            Doctor Management
          </span>
          <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{editing ? "Edit Doctor" : "Add Doctor"}</h3>
          <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
            {editing
              ? "Update the doctor profile, consultation fees and commission setup."
              : "Register a new doctor and set consultation, follow-up, emergency and commission details."}
          </p>
        </div>

        <button
          onClick={() => { setFormMode("list"); setEditing(null); }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors cursor-pointer"
        >
          <span>{"\u2190"} Back to Doctors</span>
        </button>

        <DoctorFormPage
          key={editing?.id ?? "new"}
          doctor={editing}
          onSubmit={submit}
          onCancel={() => { setFormMode("list"); setEditing(null); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Doctor Management
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
              onClick={() => { setEditing(null); setFormMode("form"); }}
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
                    <td className="text-[12px] font-semibold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{d.consultationFee ? formatCurrency(Number(d.consultationFee), currency) : "—"}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{d.phone ?? "—"}</td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span className={`inline-block text-[10px] font-bold capitalize px-2 py-0.5 rounded-md border ${STATUS_STYLES[d.status]}`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setViewing(d)}
                          className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                          title="View doctor profile"
                        >
                          <FiEye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setEditing(d); setFormMode("form"); }}
                          className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                          title="Edit doctor"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleStatus(d)}
                          className={`p-2 rounded-lg border bg-[var(--bg)] transition-colors ${
                            d.status === "active"
                              ? "text-amber-600 border-amber-200 hover:text-amber-700 hover:border-amber-400"
                              : "text-emerald-600 border-emerald-200 hover:text-emerald-700 hover:border-emerald-400"
                          }`}
                          title={d.status === "active" ? "Deactivate doctor" : "Activate doctor"}
                        >
                          {d.status === "active" ? <FiUserX className="w-3.5 h-3.5" /> : <FiUserCheck className="w-3.5 h-3.5" />}
                        </button>
                      </div>
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

      {viewing && (
        <DoctorProfileModal
          doctor={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function DoctorFormPage({
  doctor,
  onSubmit,
  onCancel,
}: {
  doctor: DoctorRecord | null;
  onSubmit: (input: CreateDoctorInput) => Promise<void>;
  onCancel: () => void;
}) {
  const editing = !!doctor;
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [name, setName] = useState(doctor?.name ?? "");
  const [departmentId, setDepartmentId] = useState<string>(doctor?.departmentId ? String(doctor.departmentId) : "");
  const [specialization, setSpecialization] = useState(doctor?.specialization ?? "");
  const [qualification, setQualification] = useState(doctor?.qualification ?? "");
  const [registrationNo, setRegistrationNo] = useState(doctor?.registrationNo ?? "");
  const [phone, setPhone] = useState(doctor?.phone ?? "");
  const [email, setEmail] = useState(doctor?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consultationFee, setConsultationFee] = useState(doctor?.consultationFee ?? "");
  const [followupFee, setFollowupFee] = useState(doctor?.followupFee ?? "");
  const [emergencyFee, setEmergencyFee] = useState(doctor?.emergencyFee ?? "");
  const [commissionType, setCommissionType] = useState<"" | "PERCENT" | "FIXED">(doctor?.commissionType as "" | "PERCENT" | "FIXED" ?? "");
  const [commissionValue, setCommissionValue] = useState(doctor?.commissionValue ?? "");
  const [status, setStatus] = useState<ActiveStatus>(doctor?.status ?? "active");
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
      addError(next, "specialization", checkText(specialization, SHORT_TEXT_MAX, "Specialization"));
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
      for (const [key, label] of [
        ["consultationFee", "Consultation fee"],
        ["followupFee", "Follow-up fee"],
        ["emergencyFee", "Emergency fee"],
        ["commissionValue", "Commission value"],
      ] as const) {
        addError(next, key, checkMoney({ consultationFee, followupFee, emergencyFee, commissionValue }[key], label));
      }
      if (commissionType && !commissionValue.trim()) {
        addError(next, "commissionValue", "Commission value is required when commission type is set.");
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
        specialization: specialization.trim() || null,
        qualification: qualification.trim() || null,
        registrationNo: registrationNo.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        consultationFee: consultationFee.trim() || null,
        followupFee: followupFee.trim() || null,
        emergencyFee: emergencyFee.trim() || null,
        commissionType: commissionType || null,
        commissionValue: commissionValue.trim() || null,
        status,
        ...(!editing
          ? { password: password.trim(), confirmPassword: confirmPassword.trim() || password.trim() }
          : {}),
      });
    } catch (err) {
      // Per-field messages from the server are shown next to the input that
      // caused them instead of a single opaque banner.
      if (err instanceof ValidationError) {
        setFieldErrors(err.fieldErrors ?? {});
        setError("Please correct the highlighted fields.");
      } else if (err instanceof NotFoundError) {
        // Reference checks (branch / department) land on the related select.
        const key = /department/i.test(err.message) ? "departmentId" : "";
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
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Doctors</span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{editing ? "Edit Doctor" : "Add Doctor"}</h3>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Registration No.</label>
            <input value={registrationNo} onChange={(e) => setRegistrationNo(setField("registrationNo", e.target.value))} className={INPUT_CLS} />
            {fieldError("registrationNo")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(setField("name", e.target.value))} className={INPUT_CLS} />
            {fieldError("name")}
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
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Specialization</label>
            <input value={specialization} onChange={(e) => setSpecialization(setField("specialization", e.target.value))} className={INPUT_CLS} />
            {fieldError("specialization")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Qualification</label>
            <input value={qualification} onChange={(e) => setQualification(setField("qualification", e.target.value))} className={INPUT_CLS} />
            {fieldError("qualification")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Phone</label>
            <input value={phone} inputMode="tel" onChange={(e) => setPhone(setField("phone", sanitizePhone(e.target.value)))} className={INPUT_CLS} />
            {fieldError("phone")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(setField("email", e.target.value))} className={INPUT_CLS} />
            {fieldError("email")}
          </div>
          {!editing && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Password * (creates login)</label>
                <input type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(setField("password", e.target.value))} className={INPUT_CLS} />
                <p className="text-[10px] text-[var(--muted)] mt-1">A login account is created for every doctor.</p>
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
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Consultation Fee</label>
            <input value={consultationFee} inputMode="decimal" onChange={(e) => setConsultationFee(setField("consultationFee", sanitizeMoney(e.target.value)))} className={INPUT_CLS} />
            {fieldError("consultationFee")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Follow-up Fee</label>
            <input value={followupFee} inputMode="decimal" onChange={(e) => setFollowupFee(setField("followupFee", sanitizeMoney(e.target.value)))} className={INPUT_CLS} />
            {fieldError("followupFee")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Emergency Fee</label>
            <input value={emergencyFee} inputMode="decimal" onChange={(e) => setEmergencyFee(setField("emergencyFee", sanitizeMoney(e.target.value)))} className={INPUT_CLS} />
            {fieldError("emergencyFee")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Commission Type</label>
            <select value={commissionType} onChange={(e) => setCommissionType(e.target.value as "" | "PERCENT" | "FIXED")} className={INPUT_CLS}>
              <option value="">— None —</option>
              <option value="PERCENT">Percentage (%)</option>
              <option value="FIXED">Fixed amount</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Commission Value</label>
            <input
              value={commissionValue}
              inputMode="decimal"
              disabled={!commissionType}
              placeholder={commissionType === "PERCENT" ? "e.g. 5" : commissionType === "FIXED" ? "e.g. 50" : ""}
              onChange={(e) => setCommissionValue(setField("commissionValue", sanitizeMoney(e.target.value)))}
              className={INPUT_CLS}
            />
            {fieldError("commissionValue")}
          </div>
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
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Doctor"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}
            className="px-4 py-3 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            Cancel
          </button>
        </div>
      </form>
  );
}

function DoctorProfileModal({
  doctor,
  onClose,
}: {
  doctor: DoctorRecord;
  onClose: () => void;
}) {
  const { currency } = useCurrency();
  const [data, setData] = useState<DoctorRecord | null>(doctor);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    doctorApi.get(doctor.id)
      .then((r) => { if (active) setData(r.doctor); })
      .catch((err) => { if (active) setError(errorMessage(err)); });
    return () => { active = false; };
  }, [doctor.id]);

  const fee = (v: string | null | undefined) =>
    v ? formatCurrency(Number(v), currency) : "—";

  const fields: [string, string | null | undefined][] = [
    ["Doctor Code", data?.doctorCode],
    ["Name", data?.name],
    ["Department", data?.department?.name ?? "—"],
    ["Specialization", data?.specialization],
    ["Qualification", data?.qualification],
    ["Registration No.", data?.registrationNo],
    ["Phone", data?.phone],
    ["Email", data?.email],
    ["Consultation Fee", fee(data?.consultationFee)],
    ["Follow-up Fee", fee(data?.followupFee)],
    ["Emergency Fee", fee(data?.emergencyFee)],
    [
      "Commission",
      data?.commissionType
        ? `${data.commissionType === "PERCENT" ? "Percentage" : "Fixed"} · ${fee(data?.commissionValue)}`
        : "—",
    ],
    ["Status", data?.status],
    ["Created", data ? new Date(data.createdAt).toLocaleString() : "—"],
    ["Last Updated", data ? new Date(data.updatedAt).toLocaleString() : "—"],
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
      <div
        className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 animate-[scaleIn_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="flex items-center justify-between gap-3 pr-8">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Doctor Profile</span>
            <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{data?.name ?? "Loading…"}</h3>
          </div>
          <span className={`inline-block text-[10px] font-bold capitalize px-2 py-0.5 rounded-md border ${STATUS_STYLES[data?.status ?? "active"]}`}>
            {data?.status ?? "—"}
          </span>
        </div>

        {error && <p className="mt-4 text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>}

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {fields.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 border-b border-[var(--border)]/60 pb-2">
              <span className="text-[11px] font-bold text-[var(--muted)]">{label}</span>
              <span className="text-xs font-semibold text-[var(--text)] text-right break-all">{value ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}