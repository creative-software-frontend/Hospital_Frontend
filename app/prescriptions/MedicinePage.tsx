"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiX } from "react-icons/fi";
import {
  errorMessage,
  medicineApi,
  type MedicineRecord,
  type PaginationMeta,
} from "@/app/lib/api";
import { addError, checkName, checkText } from "@/app/lib/formValidation";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  genericName: "",
  brandName: "",
  medicineCode: "",
  barcode: "",
  manufacturer: "",
  reorderLevel: "10",
};

type FormState = typeof EMPTY_FORM;

const INPUT = "w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function MedicinePage({ onBack }: { onBack?: () => void }) {
  const [medicines, setMedicines] = useState<MedicineRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((kind: ToastKind, message: string) => {
    toastId.current += 1;
    setToasts((prev) => [...prev.slice(-3), { id: toastId.current, kind, message }]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await medicineApi.list({
          search: appliedSearch || undefined,
          page,
          limit: PAGE_SIZE,
        });
        setMedicines(result.data);
        setPagination(result.pagination);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [appliedSearch, page, reloadKey]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const openModal = () => {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    addError(errors, "genericName", checkName(form.genericName));
    if (!form.medicineCode.trim()) {
      addError(errors, "medicineCode", "Medicine code is required.");
    } else {
      addError(errors, "medicineCode", checkText(form.medicineCode, 191, "Medicine code"));
    }
    addError(errors, "brandName", checkText(form.brandName, 191, "Brand name"));
    addError(errors, "barcode", checkText(form.barcode, 191, "Barcode"));
    addError(errors, "manufacturer", checkText(form.manufacturer, 191, "Manufacturer"));
    const reorderLevel = Number(form.reorderLevel);
    if (!Number.isInteger(reorderLevel) || reorderLevel < 0) {
      errors.reorderLevel = "Enter a whole number of 0 or more.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const optional = (value: string) => value.trim() || undefined;
      await medicineApi.create({
        genericName: form.genericName.trim(),
        medicineCode: form.medicineCode.trim(),
        brandName: optional(form.brandName),
        barcode: optional(form.barcode),
        manufacturer: optional(form.manufacturer),
        reorderLevel,
      });
      notify("success", "Medicine added to the database.");
      setModalOpen(false);
      setPage(1);
      setReloadKey((key) => key + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {onBack && (
        <button
          onClick={onBack}
          className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] cursor-pointer print:hidden"
        >
          ← Back to Prescription Management
        </button>
      )}

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Prescription Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Medicine</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">
          All medicines saved in the database. Add a new medicine from here.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[12rem] max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, code, brand or barcode..."
              className="pl-9 w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)]"
            />
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="h-10 w-10 rounded-xl border border-[var(--border)] text-[var(--muted)] cursor-pointer hover:bg-[var(--primary-soft)]/30"
            title="Refresh"
          >
            <FiRefreshCcw className="mx-auto w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={openModal}
            className="h-10 inline-flex items-center gap-2 px-4 rounded-xl text-xs font-bold text-white cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            <FiPlus className="w-3.5 h-3.5" />
            Add Medicine
          </button>
        </div>

        {error && <p className="text-sm alert-error">{error}</p>}

        {loading ? (
          <p className="text-xs text-[var(--muted)] py-4">Loading medicines…</p>
        ) : medicines.length === 0 ? (
          <p className="text-xs text-[var(--muted)] py-4">
            {appliedSearch ? "No medicines match this search." : "No medicines in the database yet. Use “Add Medicine” to create one."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--bg)] text-[var(--muted)]">
                    <th className="text-left py-2.5 px-3">Code</th>
                    <th className="text-left py-2.5 px-3">Generic name</th>
                    <th className="text-left py-2.5 px-3">Brand</th>
                    <th className="text-left py-2.5 px-3">Manufacturer</th>
                    <th className="text-left py-2.5 px-3">Barcode</th>
                    <th className="text-left py-2.5 px-3">Reorder level</th>
                    <th className="text-left py-2.5 px-3">Stock</th>
                    <th className="text-left py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((medicine) => (
                    <tr key={medicine.id} className="border-t border-[var(--border)]">
                      <td className="py-2 px-3 font-bold text-[var(--primary-dark)]">{medicine.medicineCode}</td>
                      <td className="py-2 px-3 font-semibold text-[var(--text)]">{medicine.genericName}</td>
                      <td className="py-2 px-3 text-[var(--muted)]">{medicine.brandName ?? "—"}</td>
                      <td className="py-2 px-3 text-[var(--muted)]">{medicine.manufacturer ?? "—"}</td>
                      <td className="py-2 px-3 text-[var(--muted)]">{medicine.barcode ?? "—"}</td>
                      <td className="py-2 px-3 text-[var(--muted)]">{medicine.reorderLevel}</td>
                      <td className="py-2 px-3">
                        <span className={medicine.isLowStock ? "text-rose-600 font-bold" : "text-[var(--text)]"}>
                          {typeof medicine.totalStock === "number" ? medicine.totalStock : "—"}
                          {medicine.isLowStock && " · Low"}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${medicine.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {medicine.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 text-[11px] text-[var(--muted)]">
                <span>
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} medicines
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] cursor-pointer disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((value) => value + 1)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] cursor-pointer disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[var(--card)] p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
              <div>
                <h4 className="font-black text-lg text-[var(--primary-dark)]">Add Medicine</h4>
                <p className="text-xs text-[var(--muted)]">Saves the medicine to this branch&apos;s database.</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--bg)] cursor-pointer"
                aria-label="Close"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
                <div>
                  <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Generic name *</label>
                  <input
                    value={form.genericName}
                    onChange={(event) => setField("genericName", event.target.value)}
                    placeholder="e.g. Paracetamol"
                    className={INPUT}
                  />
                  {fieldErrors.genericName && <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.genericName}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Medicine code *</label>
                  <input
                    value={form.medicineCode}
                    onChange={(event) => setField("medicineCode", event.target.value)}
                    placeholder="e.g. MED-000001"
                    className={INPUT}
                  />
                  {fieldErrors.medicineCode && <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.medicineCode}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Brand name</label>
                  <input
                    value={form.brandName}
                    onChange={(event) => setField("brandName", event.target.value)}
                    placeholder="Optional"
                    className={INPUT}
                  />
                  {fieldErrors.brandName && <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.brandName}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Manufacturer</label>
                  <input
                    value={form.manufacturer}
                    onChange={(event) => setField("manufacturer", event.target.value)}
                    placeholder="Optional"
                    className={INPUT}
                  />
                  {fieldErrors.manufacturer && <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.manufacturer}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Barcode</label>
                  <input
                    value={form.barcode}
                    onChange={(event) => setField("barcode", event.target.value)}
                    placeholder="Optional"
                    className={INPUT}
                  />
                  {fieldErrors.barcode && <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.barcode}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Reorder level</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.reorderLevel}
                    onChange={(event) => setField("reorderLevel", event.target.value)}
                    className={INPUT}
                  />
                  {fieldErrors.reorderLevel && <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.reorderLevel}</p>}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="h-10 px-4 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--muted)] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-5 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  {saving ? "Saving…" : "Save Medicine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))} />
    </div>
  );
}
