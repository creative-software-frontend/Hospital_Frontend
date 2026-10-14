// app/dashboard/settings/branches/BranchSettingsView.tsx
// Live "Branch Settings" page backed by GET /api/branches and PATCH /api/branches/:id.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiRefreshCcw, FiSearch, FiEdit2, FiPlus } from "react-icons/fi";
import {
  branchApi,
  type BranchRecord,
  type BranchStatus,
  type PaginationMeta,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";
import { useAddressCascade } from "@/app/lib/useAddressCascade";
import {
  addError,
  checkName,
  checkEmail,
  checkBdMobile,
  checkText,
  ADDRESS_MAX,
  REGISTRATION_NO_MAX,
} from "@/app/lib/formValidation";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<BranchStatus, string> = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
};

export function BranchSettingsView() {
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [editing, setEditing] = useState<BranchRecord | null>(null);
  const [showAdd, setShowAdd] = useState(false);
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
      const result = await branchApi.list({
        page,
        limit: PAGE_SIZE,
        search: searchTerm || undefined,
      });
      setBranches(result.data);
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

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
          Branch Settings
        </h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: hospital branches, contact details and operational status.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Branches</h4>
            <p className="text-xs text-[var(--muted)]">
              {pagination ? `${pagination.total} branch(es) total` : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, code, city…"
                className="pl-9 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 w-64 max-w-full"
              />
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] hover:opacity-90"
              style={{ background: "var(--primary)" }}
            >
              <FiPlus className="w-3.5 h-3.5" />
              Add Branch
            </button>
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
          <p className="text-sm alert-error">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[900px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                {["Code", "Name", "Location", "Phone", "Email", "Status", "Actions"].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-[var(--muted)]">
                    No branches found.
                  </td>
                </tr>
              ) : (
                branches.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="text-[12px] font-bold text-[var(--primary-dark)] px-4 py-3 border-b border-[var(--border)]">
                      {b.code}
                    </td>
                    <td className="text-[12px] font-bold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {b.name}
                    </td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {[b.city, b.district, b.division].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                      {b.phone || "—"}
                    </td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                      {b.email || "—"}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span
                        className={`inline-block text-[10px] font-bold capitalize px-2 py-0.5 rounded-md border ${STATUS_STYLES[b.status]}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <button
                        onClick={() => setEditing(b)}
                        className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                        title="Edit branch"
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
          <div className="text-xs text-[var(--muted)]">
            Showing {branches.length} of {pagination?.total ?? 0} rows
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                safePage <= 1
                  ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed"
                  : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"
              }`}
            >
              Previous
            </button>
            <span className="text-xs font-bold text-[var(--muted)]">
              Page {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                safePage >= totalPages
                  ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed"
                  : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <BranchEditModal
          key={editing.id}
          branch={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            notify("success", msg);
            setEditing(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {showAdd && (
        <BranchCreateModal
          onClose={() => setShowAdd(false)}
          onSaved={(msg) => {
            notify("success", msg);
            setShowAdd(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function BranchEditModal({
  branch,
  onClose,
  onSaved,
}: {
  branch: BranchRecord;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(branch.name);
  const [registrationNo, setRegistrationNo] = useState(branch.registrationNo ?? "");
  const [address, setAddress] = useState(branch.address ?? "");
  const [division, setDivision] = useState(branch.division ?? "");
  const [district, setDistrict] = useState(branch.district ?? "");
  const [city, setCity] = useState(branch.city ?? "");
  const [phone, setPhone] = useState(branch.phone ?? "");
  const [email, setEmail] = useState(branch.email ?? "");
  const [status, setStatus] = useState<BranchStatus>(branch.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const {
    divisions,
    districts,
    localities,
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

  const INPUT_CLS =
    "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";
  const SELECT_CLS = `${INPUT_CLS} disabled:opacity-60 disabled:cursor-not-allowed`;

  const onDivisionChange = (label: string) => {
    resetDistricts();
    resetLocalities();
    setDivision(label);
    setDistrict("");
    setCity("");
    const next = divisions.find((d) => d.label === label)?.code;
    if (next) loadDistricts(next);
  };

  const onDistrictChange = (label: string) => {
    resetLocalities();
    setDistrict(label);
    setCity("");
    const next = districts.find((d) => d.label === label)?.code;
    if (next) loadLocalities(next);
  };

  // The stored division/district are labels, so the child option lists have to
  // arrive before a saved value can be shown as selected.
  const prefillDone = useRef(false);
  useEffect(() => {
    if (prefillDone.current || divisionsLoading) return;
    const savedDivision = branch.division ?? "";
    const divisionCode = savedDivision
      ? divisions.find((d) => d.label === savedDivision)?.code
      : undefined;
    prefillDone.current = true;
    if (!divisionCode) return;
    loadDistricts(divisionCode);
  }, [divisions, divisionsLoading, branch.division, loadDistricts]);

  useEffect(() => {
    if (!district || districts.length === 0 || localities.length > 0) return;
    const next = districts.find((d) => d.label === district)?.code;
    if (next) loadLocalities(next);
  }, [districts, district, localities.length, loadLocalities]);

  const fieldError = (key: string) =>
    fieldErrors[key] ? (
      <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors[key]}</p>
    ) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const next: Record<string, string> = {};
    addError(next, "name", checkName(name));
    addError(next, "registrationNo", checkText(registrationNo, REGISTRATION_NO_MAX, "Registration No."));
    addError(next, "address", checkText(address, ADDRESS_MAX, "Address"));
    addError(next, "phone", checkBdMobile(phone));
    addError(next, "email", checkEmail(email));
    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      await branchApi.update(branch.id, {
        name: name.trim(),
        registrationNo: registrationNo.trim() || null,
        address: address.trim() || null,
        division: division || null,
        district: district || null,
        city: city || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        status,
      });
      onSaved(`Branch "${name.trim()}" updated.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 animate-[scaleIn_0.25s_ease-out]"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <FiEdit2 className="hidden" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Branch Settings
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
          Edit Branch — {branch.code}
        </h3>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Branch Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} />
            {fieldError("name")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Registration No.</label>
            <input value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} className={INPUT_CLS} />
            {fieldError("registrationNo")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as BranchStatus)} className={INPUT_CLS}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={INPUT_CLS} />
            {fieldError("address")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Division</label>
            <select
              value={division}
              onChange={(e) => onDivisionChange(e.target.value)}
              className={SELECT_CLS}
              disabled={divisionsLoading}
            >
              <option value="">{divisionsLoading ? "Loading…" : "Select division"}</option>
              {divisions.map((d) => (
                <option key={d.code} value={d.label}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">District</label>
            <select
              value={district}
              onChange={(e) => onDistrictChange(e.target.value)}
              className={SELECT_CLS}
              disabled={!division || districtsLoading}
            >
              <option value="">
                {districtsLoading ? "Loading…" : !division ? "Select division first" : "Select district"}
              </option>
              {districts.map((d) => (
                <option key={d.code} value={d.label}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">City</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={SELECT_CLS}
              disabled={!district || localitiesLoading}
            >
              <option value="">
                {localitiesLoading ? "Loading…" : !district ? "Select district first" : "Select city"}
              </option>
              {localities.map((l) => (
                <option key={l.code} value={l.label}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT_CLS} />
            {fieldError("phone")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} />
            {fieldError("email")}
          </div>
          {addressError && (
            <div className="sm:col-span-2 flex items-center gap-2 text-[11px] font-semibold text-rose-600">
              <span>{addressError}</span>
              <button type="button" onClick={retryAddress} className="underline font-bold">Retry</button>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm alert-error">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            style={{ background: "var(--primary)" }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-3 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function BranchCreateModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(true);
  const [registrationNo, setRegistrationNo] = useState("");
  const [address, setAddress] = useState("");
  const [division, setDivision] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<BranchStatus>("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    branchApi
      .nextCode()
      .then((res) => {
        if (!cancelled) setCode(res.code);
      })
      .catch(() => {
        if (!cancelled) setError("Could not generate a branch code. Please close and retry.");
      })
      .finally(() => {
        if (!cancelled) setCodeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    divisions,
    districts,
    localities,
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

  const INPUT_CLS =
    "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";
  const SELECT_CLS = `${INPUT_CLS} disabled:opacity-60 disabled:cursor-not-allowed`;

  const onDivisionChange = (label: string) => {
    resetDistricts();
    resetLocalities();
    setDivision(label);
    setDistrict("");
    setCity("");
    const next = divisions.find((d) => d.label === label)?.code;
    if (next) loadDistricts(next);
  };

  const onDistrictChange = (label: string) => {
    resetLocalities();
    setDistrict(label);
    setCity("");
    const next = districts.find((d) => d.label === label)?.code;
    if (next) loadLocalities(next);
  };

  const fieldError = (key: string) =>
    fieldErrors[key] ? (
      <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors[key]}</p>
    ) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const next: Record<string, string> = {};
    addError(next, "name", checkName(name));
    addError(next, "registrationNo", checkText(registrationNo, REGISTRATION_NO_MAX, "Registration No."));
    addError(next, "address", checkText(address, ADDRESS_MAX, "Address"));
    addError(next, "phone", checkBdMobile(phone));
    addError(next, "email", checkEmail(email));
    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      await branchApi.create({
        name: name.trim(),
        registrationNo: registrationNo.trim() || null,
        address: address.trim() || null,
        division: division || null,
        district: district || null,
        city: city || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        status,
      });
      onSaved(`Branch "${name.trim()}" created.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 animate-[scaleIn_0.25s_ease-out]"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Branch Settings
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Add Branch</h3>
        <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
          Create a new hospital branch. Only a super admin can add branches.
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Branch Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} placeholder="e.g. Main Hospital" />
            {fieldError("name")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Branch Code</label>
            <input
              value={codeLoading ? "Generating…" : code}
              readOnly
              className={`${INPUT_CLS} opacity-70 cursor-not-allowed`}
            />
            <p className="text-[10px] text-[var(--muted)] mt-1">Generated automatically.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as BranchStatus)} className={INPUT_CLS}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Registration No.</label>
            <input value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} className={INPUT_CLS} />
            {fieldError("registrationNo")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT_CLS} />
            {fieldError("phone")}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={INPUT_CLS} />
            {fieldError("address")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Division</label>
            <select
              value={division}
              onChange={(e) => onDivisionChange(e.target.value)}
              className={SELECT_CLS}
              disabled={divisionsLoading}
            >
              <option value="">{divisionsLoading ? "Loading…" : "Select division"}</option>
              {divisions.map((d) => (
                <option key={d.code} value={d.label}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">District</label>
            <select
              value={district}
              onChange={(e) => onDistrictChange(e.target.value)}
              className={SELECT_CLS}
              disabled={!division || districtsLoading}
            >
              <option value="">
                {districtsLoading ? "Loading…" : !division ? "Select division first" : "Select district"}
              </option>
              {districts.map((d) => (
                <option key={d.code} value={d.label}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">City</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={SELECT_CLS}
              disabled={!district || localitiesLoading}
            >
              <option value="">
                {localitiesLoading ? "Loading…" : !district ? "Select district first" : "Select city"}
              </option>
              {localities.map((l) => (
                <option key={l.code} value={l.label}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} />
            {fieldError("email")}
          </div>
          {addressError && (
            <div className="sm:col-span-2 flex items-center gap-2 text-[11px] font-semibold text-rose-600">
              <span>{addressError}</span>
              <button type="button" onClick={retryAddress} className="underline font-bold">Retry</button>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm alert-error">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            style={{ background: "var(--primary)" }}
          >
            {saving ? "Creating..." : "Create Branch"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-3 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}