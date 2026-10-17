// app/employees/EmployeeModule.tsx
// Live "Human Resource Management" module (feature id = 16 in the dashboard).
// Lists employees from GET /api/employees with server-side pagination and
// search, and drives the create/edit flows. Every employee gets a branch-scoped
// auto-generated EMP- code plus a linked login account created with a password.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2 } from "react-icons/fi";
import {
  departmentApi,
  employeeApi,
  type ActiveStatus,
  type BloodGroup,
  type CreateEmployeeInput,
  type DepartmentRecord,
  type EmployeeRecord,
  type Gender,
  type MaritalStatus,
  type PaginationMeta,
  errorMessage,
  NotFoundError,
  toDateInput,
  ValidationError,
} from "@/app/lib/api";
import {
  ADDRESS_MAX,
  addError,
  checkDateNotFuture,
  checkDateOfBirth,
  checkEmail,
  checkMoney,
  checkName,
  checkOptionalId,
  checkPhone,
  checkText,
} from "@/app/lib/formValidation";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";
import { GENDER_OPTIONS, BLOOD_GROUP_OPTIONS, MARITAL_STATUS_OPTIONS } from "@/app/patients/constants";
import { useMasterDataOptions } from "@/app/lib/useMasterData";
import { FileUploadField } from "@/app/components/FileUploadField";

const PAGE_SIZE = 10;

const sanitizePhone = (v: string) => v.replace(/[^0-9+\-\s()]/g, "");
const sanitizeMoney = (v: string) => {
  const cleaned = v.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
};

const STATUS_STYLES: Record<ActiveStatus, string> = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
};

export function EmployeeModule() {
  const [rows, setRows] = useState<EmployeeRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [formMode, setFormMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
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
      const result = await employeeApi.list({
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

  const submit = async (input: CreateEmployeeInput): Promise<void> => {
    if (editing) {
      await employeeApi.update(editing.id, input);
      notify("success", `Employee "${input.name}" updated.`);
    } else {
      const created = await employeeApi.create(input);
      notify("success", `Employee "${input.name}" created. Emp ID: ${created.employee.employeeCode}.`);
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
            Human Resource Management
          </span>
          <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{editing ? "Edit Employee" : "Add Employee"}</h3>
          <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
            {editing
              ? "Update the employee profile, department and designation."
              : "Register a new employee; the Emp ID is generated automatically and a login account is created with the password."}
          </p>
        </div>

        <button
          onClick={() => { setFormMode("list"); setEditing(null); }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors cursor-pointer"
        >
          <span>{"\u2190"} Back to Employees</span>
        </button>

        <EmployeeFormPage
          key={editing?.id ?? "new"}
          employee={editing}
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
          Human Resource Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Employees</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: employee records with department, designation and employment type.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Employees</h4>
            <p className="text-xs text-[var(--muted)]">
              {pagination ? `${pagination.total} employee(s) total` : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, Emp ID, email…"
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
              Add Employee
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm alert-error">{error}</p>
        )}

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[900px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                {["Emp ID", "Name", "Designation", "Department", "Type", "Phone", "Status", "Actions"].map((col) => (
                  <th key={col} className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-[var(--muted)]">No employees found.</td></tr>
              ) : (
                rows.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="text-[12px] font-bold text-[var(--primary-dark)] px-4 py-3 border-b border-[var(--border)]">{emp.employeeCode}</td>
                    <td className="text-[12px] font-bold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{emp.name}</td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{emp.designation?.name ?? "—"}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{emp.department?.name ?? "—"}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{emp.employeeType?.name ?? "—"}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{emp.phone ?? "—"}</td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span className={`inline-block text-[10px] font-bold capitalize px-2 py-0.5 rounded-md border ${STATUS_STYLES[emp.status]}`}>{emp.status}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <button
                        onClick={() => { setEditing(emp); setFormMode("form"); }}
                        className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                        title="Edit employee"
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

function EmployeeFormPage({
  employee,
  onSubmit,
  onCancel,
}: {
  employee: EmployeeRecord | null;
  onSubmit: (input: CreateEmployeeInput) => Promise<void>;
  onCancel: () => void;
}) {
  const editing = !!employee;
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [designations, setDesignations] = useState<{ id: number; name: string }[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<{ id: number; name: string }[]>([]);
  const [employeeCode, setEmployeeCode] = useState(employee?.employeeCode ?? "");
  const [name, setName] = useState(employee?.name ?? "");
  const [departmentId, setDepartmentId] = useState<string>(employee?.departmentId ? String(employee.departmentId) : "");
  const [designationId, setDesignationId] = useState<string>(employee?.designationId ? String(employee.designationId) : "");
  const [employeeTypeId, setEmployeeTypeId] = useState<string>(employee?.employeeTypeId ? String(employee.employeeTypeId) : "");
  const [hireDate, setHireDate] = useState(employee?.hireDate ? toDateInput(employee.hireDate) : "");
  const [basicSalary, setBasicSalary] = useState(employee?.basicSalary ?? "");
  const [gender, setGender] = useState<string>(employee?.gender ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(employee?.dateOfBirth ? toDateInput(employee.dateOfBirth) : "");
  const [maritalStatus, setMaritalStatus] = useState<string>(employee?.maritalStatus ?? "");
  const [bloodGroup, setBloodGroup] = useState<string>(employee?.bloodGroup ?? "");
  const [photo, setPhoto] = useState(employee?.photo ?? "");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [permanentAddress, setPermanentAddress] = useState(employee?.permanentAddress ?? "");
  const [presentAddress, setPresentAddress] = useState(employee?.presentAddress ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [status, setStatus] = useState<ActiveStatus>(employee?.status ?? "active");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    // Designations and employee types are reference data; the form still loads
    // without them, so a failure here only empties those dropdowns.
    employeeApi.references()
      .then((r) => {
        if (!active) return;
        setDesignations(r.designations);
        setEmployeeTypes(r.employeeTypes);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Preview the Emp ID the record will receive. Read-only and only meaningful
  // on create; the real code is issued atomically by the server on submit.
  useEffect(() => {
    if (editing) return;
    let active = true;
    employeeApi.nextCode()
      .then((r) => { if (active) setEmployeeCode(r.code); })
      .catch(() => {});
    return () => { active = false; };
  }, [editing]);

  const { options: bloodGroups } = useMasterDataOptions("blood_groups", BLOOD_GROUP_OPTIONS);

  // Mirrors the backend Zod rules so an obviously bad value is caught before a
  // round trip; the server still has the final say.
  const validate = (): boolean => {
    const next: Record<string, string> = {};
    addError(next, "name", checkName(name));
    addError(next, "email", checkEmail(email));
    addError(next, "phone", checkPhone(phone));
    addError(next, "basicSalary", checkMoney(basicSalary, "Basic salary"));
    addError(next, "permanentAddress", checkText(permanentAddress, ADDRESS_MAX, "Permanent address"));
    addError(next, "presentAddress", checkText(presentAddress, ADDRESS_MAX, "Present address"));
    addError(next, "departmentId", checkOptionalId(departmentId, "department"));
    addError(next, "designationId", checkOptionalId(designationId, "designation"));
    addError(next, "employeeTypeId", checkOptionalId(employeeTypeId, "employee type"));
    addError(next, "hireDate", checkDateNotFuture(hireDate, "Hire date"));
    addError(next, "dateOfBirth", checkDateOfBirth(dateOfBirth));
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
        designationId: designationId ? Number(designationId) : null,
        employeeTypeId: employeeTypeId ? Number(employeeTypeId) : null,
        hireDate: hireDate || null,
        basicSalary: basicSalary.trim() || null,
        gender: gender ? (gender as Gender) : null,
        dateOfBirth: dateOfBirth || null,
        maritalStatus: maritalStatus ? (maritalStatus as MaritalStatus) : null,
        bloodGroup: bloodGroup ? (bloodGroup as BloodGroup) : null,
        photo: photo || null,
        phone: phone.trim() || null,
        permanentAddress: permanentAddress.trim() || null,
        presentAddress: presentAddress.trim() || null,
        email: email.trim() || null,
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
        // Reference checks (department / designation / employee type) land on
        // the related select.
        const key = /designation/i.test(err.message)
          ? "designationId"
          : /employee type/i.test(err.message)
            ? "employeeTypeId"
            : /department/i.test(err.message)
              ? "departmentId"
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
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Human Resource</span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{editing ? "Edit Employee" : "Add Employee"}</h3>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Emp ID</label>
            <input
              value={editing ? employeeCode : (employeeCode || "Generating…")}
              readOnly
              disabled
              className={`${INPUT_CLS} bg-[var(--border)]/30 font-bold text-[var(--primary-dark)] cursor-not-allowed`}
            />
            <p className="text-[10px] text-[var(--muted)] mt-1">Generated automatically.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Hire Date</label>
            <input type="date" value={hireDate} onChange={(e) => setHireDate(setField("hireDate", e.target.value))} className={INPUT_CLS} />
            {fieldError("hireDate")}
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
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Designation</label>
            <select value={designationId} onChange={(e) => setDesignationId(e.target.value)} className={INPUT_CLS}>
              <option value="">— None —</option>
              {designations.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </select>
            {fieldError("designationId")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Employee Type</label>
            <select value={employeeTypeId} onChange={(e) => setEmployeeTypeId(e.target.value)} className={INPUT_CLS}>
              <option value="">— None —</option>
              {employeeTypes.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
            </select>
            {fieldError("employeeTypeId")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Basic Salary</label>
            <input value={basicSalary} inputMode="decimal"
              onChange={(e) => setBasicSalary(setField("basicSalary", sanitizeMoney(e.target.value)))} className={INPUT_CLS} />
            {fieldError("basicSalary")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={INPUT_CLS}>
              <option value="">— None —</option>
              {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(setField("email", e.target.value))} className={INPUT_CLS} />
            {fieldError("email")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Phone</label>
            <input value={phone} inputMode="tel" onChange={(e) => setPhone(setField("phone", sanitizePhone(e.target.value)))} className={INPUT_CLS} />
            {fieldError("phone")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Permanent Address</label>
            <input value={permanentAddress} onChange={(e) => setPermanentAddress(setField("permanentAddress", e.target.value))} className={INPUT_CLS} />
            {fieldError("permanentAddress")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Present Address</label>
            <input value={presentAddress} onChange={(e) => setPresentAddress(setField("presentAddress", e.target.value))} className={INPUT_CLS} />
            {fieldError("presentAddress")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Date of Birth</label>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(setField("dateOfBirth", e.target.value))} className={INPUT_CLS} />
            {fieldError("dateOfBirth")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Marital Status</label>
            <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className={INPUT_CLS}>
              <option value="">— None —</option>
              {MARITAL_STATUS_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Blood Group</label>
            <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className={INPUT_CLS}>
              <option value="">— None —</option>
              {bloodGroups.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ActiveStatus)} className={INPUT_CLS}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {!editing && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Password * (creates login)</label>
                <input type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(setField("password", e.target.value))} className={INPUT_CLS} />
                <p className="text-[10px] text-[var(--muted)] mt-1">A login account is created for every employee.</p>
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

          <div className="sm:col-span-2 mt-1 border-t border-[var(--border)] pt-4">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Attachments</span>
          </div>
          <FileUploadField label="Picture" kind="photo" value={photo} onChange={setPhoto} preview="image" hint="JPG, PNG or WebP up to 5 MB." />
        </div>

        {error && <p className="mt-4 text-sm alert-error">{error}</p>}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6">
          <button type="submit" disabled={saving}
            className="w-full sm:w-56 px-6 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            style={{ background: "var(--primary)" }}>
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Employee"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}
            className="px-4 py-3 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            Cancel
          </button>
        </div>
      </form>
  );
}
