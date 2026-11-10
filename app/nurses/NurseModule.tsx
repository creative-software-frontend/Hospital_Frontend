// app/nurses/NurseModule.tsx
// Live "Nursing Management" module (feature id = 13 in the dashboard).
// Lists nurses from GET /api/nurses with server-side pagination and search,
// and drives the create/edit flows. Nurses are first-class records with their
// own branch-scoped NUR- code, so this replaces the previous static table.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2 } from "react-icons/fi";
import {
  departmentApi,
  nurseApi,
  type ActiveStatus,
  type BloodGroup,
  type CreateNurseInput,
  type DepartmentRecord,
  type Gender,
  type MaritalStatus,
  type NurseRecord,
  type PaginationMeta,
  type ShiftTypeRecord,
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
  checkName,
  checkOptionalId,
  checkPhone,
  checkText,
  SHORT_TEXT_MAX,
} from "@/app/lib/formValidation";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";
import { GENDER_OPTIONS, BLOOD_GROUP_OPTIONS, MARITAL_STATUS_OPTIONS } from "@/app/patients/constants";
import { useMasterDataOptions } from "@/app/lib/useMasterData";
import { useAddressCascade } from "@/app/lib/useAddressCascade";
import { FileUploadField } from "@/app/components/FileUploadField";
import { NursingNotesPage } from "@/app/nurses/NursingNotesPage";
import { PatientVitalsPage } from "@/app/nurses/PatientVitalsPage";
import { MedicationTrackingPage } from "@/app/nurses/MedicationTrackingPage";
import { ShiftManagementPage } from "@/app/employees/ShiftManagementPage";

const PAGE_SIZE = 10;

const sanitizePhone = (v: string) => v.replace(/[^0-9+\-\s()]/g, "");

const STATUS_STYLES: Record<ActiveStatus, string> = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
};

export function NurseModule({
  pageKey,
  onNavigate,
}: {
  pageKey?: string;
  onNavigate?: (key: string | null) => void;
}) {
  const [rows, setRows] = useState<NurseRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
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

  if (pageKey === "nursing-notes") {
    return <NursingNotesPage onBack={() => onNavigate?.(null)} />;
  }

  if (pageKey === "patient-monitoring") {
    return <PatientVitalsPage onBack={() => onNavigate?.(null)} />;
  }

  if (pageKey === "medication-tracking") {
    return <MedicationTrackingPage onBack={() => onNavigate?.(null)} />;
  }

  if (pageKey === "shift-management") {
    return <ShiftManagementPage onBack={() => onNavigate?.(null)} module="Nursing Management" />;
  }

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
    if (pageKey) onNavigate?.(null);
    setReloadKey((k) => k + 1);
  };

  const closeForm = () => {
    setFormMode("list");
    setEditing(null);
    if (pageKey) onNavigate?.(null);
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
          onClick={closeForm}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors cursor-pointer"
        >
          <span>{"\u2190"} Back to Nurses</span>
        </button>

        <NurseFormPage
          key={editing?.id ?? "new"}
          nurse={editing}
          onSubmit={submit}
          onCancel={closeForm}
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
          Live from the backend: nurse profiles, department and shift.
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
            {pageKey === "nurse-registration" && (
              <button
                onClick={() => {
                  setEditing(null);
                  setFormMode("form");
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
                style={{ background: "var(--primary)" }}
              >
                <FiPlus className="w-3.5 h-3.5" />
                Register New Nurse
              </button>
            )}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, ID, qualification…"
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
          </div>
        </div>

        {error && (
          <p className="text-sm alert-error">{error}</p>
        )}

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[900px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                {["ID", "Name", "Qualification", "Department", "Shift", "Phone", "Status", "Actions"].map((col) => (
                  <th key={col} className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-[var(--muted)]">No nurses found.</td></tr>
              ) : (
                rows.map((n) => (
                  <tr key={n.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="text-[12px] font-bold text-[var(--primary-dark)] px-4 py-3 border-b border-[var(--border)]">{n.nurseCode}</td>
                    <td className="text-[12px] font-bold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{n.name}</td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{n.qualification ?? "—"}</td>
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
  const [joiningDate, setJoiningDate] = useState(nurse?.joiningDate ? toDateInput(nurse.joiningDate) : "");
  const [gender, setGender] = useState<string>(nurse?.gender ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(nurse?.dateOfBirth ? toDateInput(nurse.dateOfBirth) : "");
  const [maritalStatus, setMaritalStatus] = useState<string>(nurse?.maritalStatus ?? "");
  const [bloodGroup, setBloodGroup] = useState<string>(nurse?.bloodGroup ?? "");
  const [photo, setPhoto] = useState(nurse?.photo ?? "");
  const [signature, setSignature] = useState(nurse?.signature ?? "");
  const [cv, setCv] = useState(nurse?.cv ?? "");
  const [phone, setPhone] = useState(nurse?.phone ?? "");
  const [permanentAddress, setPermanentAddress] = useState(nurse?.permanentAddress ?? "");
  const [presentAddress, setPresentAddress] = useState(nurse?.presentAddress ?? "");
  const [division, setDivision] = useState(nurse?.division ?? "");
  const [district, setDistrict] = useState(nurse?.district ?? "");
  const [upazila, setUpazila] = useState(nurse?.upazila ?? "");
  const [thana, setThana] = useState(nurse?.thana ?? "");
  const [email, setEmail] = useState(nurse?.email ?? "");
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

  const clearFieldError = (key: string) =>
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));

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

  const { options: bloodGroups } = useMasterDataOptions("blood_groups", BLOOD_GROUP_OPTIONS);

  const {
    divisions,
    districts,
    localities: upazilas,
    divisionsLoading,
    districtsLoading,
    localitiesLoading,
    addressError,
    retryAddress,
    loadDistricts,
    loadLocalities,
    resetDistricts,
    resetLocalities,
  } = useAddressCascade();

  const onDivisionChange = (label: string) => {
    clearFieldError("division");
    resetDistricts();
    resetLocalities();
    setDivision(label);
    setDistrict("");
    setUpazila("");
    setThana("");
    const code = divisions.find((d) => d.label === label)?.code;
    if (code) loadDistricts(code);
  };

  const onDistrictChange = (label: string) => {
    clearFieldError("district");
    resetLocalities();
    setDistrict(label);
    setUpazila("");
    setThana("");
    const code = districts.find((d) => d.label === label)?.code;
    if (code) loadLocalities(code);
  };

  const onUpazilaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    clearFieldError("upazila");
    const label = e.target.value;
    setUpazila(label);
    setThana("");
  };

  // Prefill division/district/upazila from saved values when options load
  const prefillDone = useRef(false);
  useEffect(() => {
    if (prefillDone.current || divisionsLoading) return;
    const savedDivision = division;
    if (!savedDivision) {
      prefillDone.current = true;
      return;
    }
    const divisionCode = divisions.find((d) => d.label === savedDivision)?.code;
    if (!divisionCode) {
      prefillDone.current = true;
      return;
    }
    prefillDone.current = true;
    loadDistricts(divisionCode);
    const savedDistrict = district;
    if (!savedDistrict) return;
    const districtCode = districts.find((d) => d.label === savedDistrict)?.code;
    if (districtCode) loadLocalities(districtCode);
  }, [divisions, divisionsLoading, loadDistricts, loadLocalities, division, district]);

  useEffect(() => {
    if (!district || districts.length === 0 || upazilas.length > 0) return;
    const code = districts.find((d) => d.label === district)?.code;
    if (code) loadLocalities(code);
  }, [district, districts, upazilas.length, loadLocalities]);

  // Mirrors the backend Zod rules so an obviously bad value is caught before a
  // round trip; the server still has the final say.
  const validate = (): boolean => {
      const next: Record<string, string> = {};
      addError(next, "name", checkName(name));
      addError(next, "email", checkEmail(email));
      addError(next, "phone", checkPhone(phone));
      addError(next, "permanentAddress", checkText(permanentAddress, ADDRESS_MAX, "Permanent address"));
      addError(next, "presentAddress", checkText(presentAddress, ADDRESS_MAX, "Present address"));

      // A district or lower level without a division would be orphaned data, so
      // the cascade has to be consistent top down.
      for (const [child, parent, label] of [
        ["district", "division", "Division"],
        ["upazila", "district", "District"],
        ["thana", "district", "District"],
      ] as const) {
        const childValue = (({ division: division, district: district, upazila: upazila, thana: thana } as Record<string, string>)[child] || "").trim();
        const parentValue = (({ division: division, district: district, upazila: upazila, thana: thana } as Record<string, string>)[parent] || "").trim();
        if (childValue && !parentValue) {
          addError(next, parent, `${label} is required to select ${child}.`);
        }
      }
      addError(next, "departmentId", checkOptionalId(departmentId, "department"));
      addError(next, "shiftTypeId", checkOptionalId(shiftTypeId, "shift"));
      addError(next, "qualification", checkText(qualification, SHORT_TEXT_MAX, "Qualification"));
      addError(next, "joiningDate", checkDateNotFuture(joiningDate, "Joining date"));
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
        shiftTypeId: shiftTypeId ? Number(shiftTypeId) : null,
        qualification: qualification.trim() || null,
        joiningDate: joiningDate || null,
        gender: gender ? (gender as Gender) : null,
        dateOfBirth: dateOfBirth || null,
        maritalStatus: maritalStatus ? (maritalStatus as MaritalStatus) : null,
        bloodGroup: bloodGroup ? (bloodGroup as BloodGroup) : null,
        photo: photo || null,
        signature: signature || null,
        cv: cv || null,
        phone: phone.trim() || null,
        permanentAddress: permanentAddress.trim() || null,
        presentAddress: presentAddress.trim() || null,
        division: division.trim() || null,
        district: district.trim() || null,
        upazila: upazila.trim() || null,
        thana: thana.trim() || null,
        email: email.trim() || null,
        ...(!editing
          ? { password: password.trim(), confirmPassword: confirmPassword.trim() || password.trim() }
          : {}),
        status: "active",
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
      className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm w-full flex flex-col">
        <div className="px-6 py-4 border-b border-[var(--border)] shrink-0">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
            Nursing Management
          </span>
          <h3 className="font-black text-lg text-[var(--primary-dark)] mt-0.5">
            {editing ? "Edit Nurse" : "Register New Nurse"}
          </h3>
        </div>

        <div className="px-6 py-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Joining Date</label>
            <input type="date" value={joiningDate} onChange={(e) => setJoiningDate(setField("joiningDate", e.target.value))} className={INPUT_CLS} />
            {fieldError("joiningDate")}
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
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Shift</label>
            <select value={shiftTypeId} onChange={(e) => setShiftTypeId(e.target.value)} className={INPUT_CLS}>
              <option value="">— None —</option>
              {shiftTypes.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
            {fieldError("shiftTypeId")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Qualification</label>
            <input value={qualification} onChange={(e) => setQualification(setField("qualification", e.target.value))} className={INPUT_CLS} />
            {fieldError("qualification")}
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
          <div className="sm:col-span-2 lg:col-span-4">
            <div className="mb-3">
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Permanent Address</label>
              <p className="text-[10px] font-semibold text-[var(--muted)] mb-2">Select your permanent residential location in Bangladesh.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Permanent Address</label>
                <input value={permanentAddress} onChange={(e) => setPermanentAddress(setField("permanentAddress", e.target.value))} className={INPUT_CLS} />
                {fieldError("permanentAddress")}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Division</label>
                <select value={division} onChange={(e) => onDivisionChange(e.target.value)} className={INPUT_CLS} disabled={saving || divisionsLoading}>
                  <option value="">
                    {divisionsLoading
                      ? "Loading divisions..."
                      : divisions.length === 0
                        ? "No divisions available"
                        : "Select division"}
                  </option>
                  {divisions.map((d) => (
                    <option key={d.code} value={d.label}>{d.label}</option>
                  ))}
                </select>
                {fieldError("division")}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">District</label>
                <select value={district} onChange={(e) => onDistrictChange(e.target.value)} className={INPUT_CLS} disabled={saving || !division || districtsLoading}>
                  <option value="">
                    {!division
                      ? "Select division first"
                      : districtsLoading
                        ? "Loading districts..."
                        : districts.length === 0
                          ? "No districts available"
                          : "Select district"}
                  </option>
                  {districts.map((d) => (
                    <option key={d.code} value={d.label}>{d.label}</option>
                  ))}
                </select>
                {fieldError("district")}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Upazila</label>
                <select value={upazila} onChange={onUpazilaChange} className={INPUT_CLS} disabled={saving || !district || localitiesLoading}>
                  <option value="">
                    {!district
                      ? "Select district first"
                      : localitiesLoading
                        ? "Loading..."
                        : upazilas.length === 0
                          ? "None for this district"
                          : "Select upazila"}
                  </option>
                  {upazilas.map((u) => (
                    <option key={u.code} value={u.label}>{u.label}</option>
                  ))}
                </select>
                {fieldError("upazila")}
              </div>
            </div>
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

          <div className="sm:col-span-2 lg:col-span-4 mt-1 border-t border-[var(--border)] pt-4">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Attachments</span>
          </div>
          <FileUploadField label="Picture" kind="photo" value={photo} onChange={setPhoto} preview="image" hint="JPG, PNG or WebP up to 5 MB." />
          <FileUploadField label="Signature" kind="signature" value={signature} onChange={setSignature} preview="image" hint="JPG, PNG or WebP up to 5 MB." />
          <FileUploadField label="CV / Résumé" kind="cv" value={cv} onChange={setCv} preview="file" hint="PDF, DOC or DOCX up to 10 MB." />
        </div>

        {error && <p className="text-sm alert-error">{error}</p>}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="w-full sm:w-56 px-6 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            style={{ background: "var(--primary)" }}>
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Nurse"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}
            className="px-4 py-3 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            Cancel
          </button>
        </div>
        </div>
      </form>
  );
}
