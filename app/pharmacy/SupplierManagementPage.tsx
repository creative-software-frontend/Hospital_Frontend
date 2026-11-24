// app/pharmacy/SupplierManagementPage.tsx
// Pharmacy Management → Supplier Management. CRUD over the uploaded
// `suppliers` table, backed by /api/suppliers.

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FiEdit2,
  FiPlus,
  FiRefreshCcw,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import {
  errorMessage,
  supplierApi,
  type ActiveStatus,
  type CreateSupplierInput,
  type PaginationMeta,
  type SupplierRecord,
} from "@/app/lib/api";
import { checkBdMobile, checkMoney, checkText } from "@/app/lib/formValidation";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const PAGE_SIZE = 10;

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";
const LABEL_CLS = "block text-xs font-semibold text-[var(--muted)] mb-1";
const BTN_GHOST =
  "inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer";

interface FormState {
  name: string;
  mobile: string;
  address: string;
  balance: string;
  shop: string;
  status: ActiveStatus;
}

const EMPTY_FORM: FormState = {
  name: "",
  mobile: "",
  address: "",
  balance: "",
  shop: "3",
  status: "active",
};

interface FieldErrors {
  name?: string;
  mobile?: string;
  address?: string;
  balance?: string;
  shop?: string;
}

export function SupplierManagementPage({ onBack }: { onBack?: () => void }) {
  const [rows, setRows] = useState<SupplierRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActiveStatus | "">("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
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
      const result = await supplierApi.list({
        page,
        limit: PAGE_SIZE,
        search: searchTerm || undefined,
        status: statusFilter || undefined,
      });
      setRows(result.data);
      setPagination(result.pagination);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
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

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFieldErrors({});
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (row: SupplierRecord) => {
    setEditing(row);
    setForm({
      name: row.name,
      mobile: row.mobile ?? "",
      address: row.address ?? "",
      balance: row.balance == null ? "" : String(row.balance),
      shop: String(row.shop),
      status: row.status,
    });
    setFieldErrors({});
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
  };

  const submit = async () => {
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = "Supplier name is required.";
    else if (checkText(form.name, 255, "Supplier name")) errors.name = checkText(form.name, 255, "Supplier name");

    const mobileError = checkBdMobile(form.mobile);
    if (mobileError) errors.mobile = mobileError;

    const addressError = checkText(form.address, 2000, "Address");
    if (addressError) errors.address = addressError;

    const balanceError = checkMoney(form.balance, "Balance");
    if (balanceError) errors.balance = balanceError;

    const shopValue = Number(form.shop);
    if (!Number.isInteger(shopValue) || shopValue < 1 || shopValue > 100) {
      errors.shop = "Shop must be a whole number between 1 and 100.";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setFormError("");
    try {
      const input: CreateSupplierInput = {
        name: form.name.trim(),
        mobile: form.mobile.trim() || null,
        address: form.address.trim() || null,
        balance: form.balance.trim() ? Number(form.balance) : null,
        shop: shopValue,
        status: form.status,
      };
      if (editing) {
        await supplierApi.update(editing.id, input);
        notify("success", `Supplier "${input.name}" updated.`);
      } else {
        await supplierApi.create(input);
        notify("success", `Supplier "${input.name}" added.`);
      }
      setFormOpen(false);
      setEditing(null);
      setPage(1);
      setSearchTerm("");
      setSearchInput("");
      setStatusFilter("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: SupplierRecord) => {
    setTogglingId(row.id);
    try {
      const next: ActiveStatus = row.status === "active" ? "inactive" : "active";
      await supplierApi.update(row.id, { status: next });
      notify("success", `Supplier "${row.name}" is now ${next}.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async (row: SupplierRecord) => {
    if (!window.confirm(`Delete supplier "${row.name}"?`)) return;
    try {
      await supplierApi.remove(row.id);
      notify("success", `Supplier "${row.name}" deleted.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors cursor-pointer"
        >
          ← Back to Pharmacy Management
        </button>
      )}

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Pharmacy Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Supplier Management</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Suppliers imported from the pharmacy system. Search, add, edit, activate or remove supplier records.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Suppliers</h4>
            <p className="text-xs text-[var(--muted)]">
              {pagination ? `${pagination.total} supplier(s) total` : "Loading…"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, mobile, address…"
                className="pl-9 w-64 max-w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ActiveStatus | "");
                setPage(1);
              }}
              className="w-32 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className={BTN_GHOST}
              title="Refresh"
            >
              <FiRefreshCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] cursor-pointer"
              style={{ background: "var(--primary)" }}
            >
              <FiPlus className="w-3.5 h-3.5" />
              Add Supplier
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
              {searchTerm || statusFilter
                ? "No suppliers match these filters."
                : "No suppliers have been added yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-[820px] w-full">
              <thead>
                <tr className="bg-[var(--bg)]">
                  {["ID", "Name", "Mobile", "Address", "Balance", "Shop", "Status", "Actions"].map((col) => (
                    <th
                      key={col}
                      className="text-left text-[11px] font-bold text-[var(--muted)] px-3 py-3 border-b border-[var(--border)] whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="text-[12px] font-bold text-[var(--muted)] px-3 py-3 border-b border-[var(--border)]">
                      #{row.id}
                    </td>
                    <td className="text-[12px] font-bold text-[var(--text)] px-3 py-3 border-b border-[var(--border)] max-w-[16rem] truncate">
                      {row.name}
                    </td>
                    <td className="text-[12px] text-[var(--text)] px-3 py-3 border-b border-[var(--border)] whitespace-nowrap">
                      {row.mobile ?? "—"}
                    </td>
                    <td className="text-[12px] text-[var(--text)] px-3 py-3 border-b border-[var(--border)] max-w-[14rem] truncate">
                      {row.address ?? "—"}
                    </td>
                    <td className="text-[12px] font-semibold text-[var(--text)] px-3 py-3 border-b border-[var(--border)] whitespace-nowrap">
                      {row.balance == null ? "—" : row.balance.toFixed(2)}
                    </td>
                    <td className="text-[12px] text-[var(--muted)] px-3 py-3 border-b border-[var(--border)]">
                      {row.shop}
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--border)]">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[10px] font-extrabold ${
                          row.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {row.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleStatus(row)}
                          disabled={togglingId === row.id}
                          className="px-2.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors disabled:opacity-50 cursor-pointer"
                          title={row.status === "active" ? "Deactivate supplier" : "Activate supplier"}
                        >
                          {togglingId === row.id
                            ? "…"
                            : row.status === "active"
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors cursor-pointer"
                          title="Edit supplier"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(row)}
                          className="p-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                          title="Delete supplier"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
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
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${safePage <= 1 ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] opacity-60" : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)]"}`}
                >
                  Previous
                </button>
                <span className="text-xs font-bold text-[var(--muted)]">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${safePage >= totalPages ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] opacity-60" : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)]"}`}
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
              className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors disabled:opacity-50 cursor-pointer"
              aria-label="Close"
            >
              <FiX className="w-4 h-4" />
            </button>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
              Pharmacy Management
            </span>
            <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
              {editing ? "Edit Supplier" : "Add Supplier"}
            </h3>

            {formError && <div className="mt-4 alert-error text-xs">{formError}</div>}

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
              <div className="sm:col-span-2">
                <label className={LABEL_CLS}>Supplier name *</label>
                <input
                  className={INPUT_CLS}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={saving}
                  placeholder="Supplier name"
                />
                {fieldErrors.name && <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className={LABEL_CLS}>Mobile</label>
                <input
                  className={INPUT_CLS}
                  value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                  disabled={saving}
                  placeholder="01712345678"
                />
                {fieldErrors.mobile && <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.mobile}</p>}
              </div>
              <div>
                <label className={LABEL_CLS}>Shop</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={INPUT_CLS}
                  value={form.shop}
                  onChange={(e) => setForm((f) => ({ ...f, shop: e.target.value }))}
                  disabled={saving}
                />
                {fieldErrors.shop && <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.shop}</p>}
              </div>
              <div>
                <label className={LABEL_CLS}>Balance</label>
                <input
                  type="number"
                  step="0.01"
                  className={INPUT_CLS}
                  value={form.balance}
                  onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                  disabled={saving}
                  placeholder="0.00"
                />
                {fieldErrors.balance && <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.balance}</p>}
              </div>
              <div>
                <label className={LABEL_CLS}>Status</label>
                <select
                  className={INPUT_CLS}
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ActiveStatus }))}
                  disabled={saving}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLS}>Address</label>
                <textarea
                  rows={2}
                  className={`${INPUT_CLS} resize-none`}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  disabled={saving}
                  placeholder="Optional address"
                />
                {fieldErrors.address && <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.address}</p>}
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
                {saving ? "Saving…" : editing ? "Save changes" : "Add supplier"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
