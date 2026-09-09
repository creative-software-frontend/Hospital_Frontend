// app/dashboard/settings/master-data/MasterDataView.tsx
// Live "Master Data" page backed by GET / POST / PATCH / DELETE /api/settings/master-data.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2, FiTrash2 } from "react-icons/fi";
import {
  settingsApi,
  type ActiveStatus,
  type CreateMasterDataInput,
  type MasterDataCategory,
  type MasterDataItem,
  MASTER_DATA_CATEGORIES,
  MASTER_DATA_CATEGORY_LABELS,
  MASTER_DATA_CATEGORY_EXAMPLES,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const STATUS_STYLES: Record<ActiveStatus, string> = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
};

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

export function MasterDataView() {
  const [items, setItems] = useState<MasterDataItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<MasterDataCategory>("cities");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MasterDataItem | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<MasterDataItem | null>(null);
  const [deleting, setDeleting] = useState(false);
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
      const result = await settingsApi.masterData.list();
      setItems(result.items);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const counts = useMemo(() => {
    const map: Record<MasterDataCategory, number> = {
      cities: 0,
      areas: 0,
      visit_types: 0,
      blood_groups: 0,
      payment_methods: 0,
      document_types: 0,
    };
    for (const item of items) map[item.category] += 1;
    return map;
  }, [items]);

  const categoryItems = useMemo(() => {
    const base = items.filter((i) => i.category === activeCategory);
    const term = searchInput.trim().toLowerCase();
    if (!term) return base;
    return base.filter(
      (i) => i.label.toLowerCase().includes(term) || (i.code ?? "").toLowerCase().includes(term),
    );
  }, [items, activeCategory, searchInput]);

  const submit = async (input: CreateMasterDataInput) => {
    if (editing) {
      await settingsApi.masterData.update(editing.id, input);
      notify("success", `"${input.label}" updated.`);
    } else {
      await settingsApi.masterData.create(input);
      notify("success", `"${input.label}" added to ${MASTER_DATA_CATEGORY_LABELS[input.category]}.`);
    }
    setFormOpen(false);
    setEditing(null);
    setReloadKey((k) => k + 1);
  };

  const handleDelete = async () => {
    if (!confirmingDelete || deleting) return;
    setDeleting(true);
    try {
      await settingsApi.masterData.remove(confirmingDelete.id);
      notify("success", `"${confirmingDelete.label}" deleted.`);
      setConfirmingDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Master Data</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: reference data used across the system — cities, areas, visit
          types, blood groups, payment methods and document types.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        <div className="card p-4 rounded-2xl border border-[var(--border)] shadow-sm h-fit">
          <h4 className="text-sm font-extrabold text-[var(--text)] mb-3">Categories</h4>
          <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto">
            {MASTER_DATA_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-left whitespace-nowrap rounded-xl px-3 py-2.5 border transition-colors ${
                  activeCategory === cat
                    ? "border-[var(--primary)] bg-[var(--primary-soft)]/20 text-[var(--primary-dark)]"
                    : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                <span className="block text-xs font-bold">{MASTER_DATA_CATEGORY_LABELS[cat]}</span>
                <span className="block text-[10px] text-[var(--muted)] font-semibold">
                  {counts[cat]} entr{counts[cat] === 1 ? "y" : "ies"}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[var(--muted)] font-medium mt-3 leading-relaxed">
            e.g. {MASTER_DATA_CATEGORY_EXAMPLES[activeCategory]}
          </p>
        </div>

        <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-[var(--text)]">
                {MASTER_DATA_CATEGORY_LABELS[activeCategory]}
              </h4>
              <p className="text-xs text-[var(--muted)]">
                {loading ? "Loading…" : `${counts[activeCategory]} item(s)`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search…"
                  className="pl-9 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 w-56 max-w-full"
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
                Add Item
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-[560px] w-full">
              <thead>
                <tr className="bg-[var(--bg)]">
                  {["Label", "Code", "Sort", "Status", "Actions"].map((col) => (
                    <th key={col} className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" /></td></tr>
                ) : categoryItems.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-[var(--muted)]">
                    {searchInput ? "No matching items." : `No items in ${MASTER_DATA_CATEGORY_LABELS[activeCategory]} yet.`}
                  </td></tr>
                ) : (
                  categoryItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                      <td className="px-4 py-3 border-b border-[var(--border)] text-[12px] font-bold text-[var(--text)]">{item.label}</td>
                      <td className="px-4 py-3 border-b border-[var(--border)] text-[12px] text-[var(--muted)]">{item.code ?? "—"}</td>
                      <td className="px-4 py-3 border-b border-[var(--border)] text-[12px] text-[var(--muted)]">{item.sortOrder}</td>
                      <td className="px-4 py-3 border-b border-[var(--border)]">
                        <span className={`inline-block text-[10px] font-bold capitalize px-2 py-0.5 rounded-md border ${STATUS_STYLES[item.status]}`}>{item.status}</span>
                      </td>
                      <td className="px-4 py-3 border-b border-[var(--border)]">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => { setEditing(item); setFormOpen(true); }}
                            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                            title="Edit item"
                          >
                            <FiEdit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmingDelete(item)}
                            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-red-600 hover:border-red-300 transition-colors"
                            title="Delete item"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {formOpen && (
        <MasterDataFormModal
          key={editing?.id ?? "new"}
          item={editing}
          defaultCategory={activeCategory}
          onSubmit={submit}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => !deleting && setConfirmingDelete(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
          <div onClick={(e) => e.stopPropagation()}
            className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 animate-[scaleIn_0.25s_ease-out]">
            <h3 className="font-black text-lg text-[var(--text)]">Delete item?</h3>
            <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
              &quot;{confirmingDelete.label}&quot; under{" "}
              {MASTER_DATA_CATEGORY_LABELS[confirmingDelete.category]} will be permanently removed.
              This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? "Deleting..." : "Delete Item"}
              </button>
              <button
                onClick={() => setConfirmingDelete(null)}
                disabled={deleting}
                className="px-4 py-3 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function MasterDataFormModal({
  item,
  defaultCategory,
  onSubmit,
  onClose,
}: {
  item: MasterDataItem | null;
  defaultCategory: MasterDataCategory;
  onSubmit: (input: CreateMasterDataInput) => Promise<void>;
  onClose: () => void;
}) {
  const editing = !!item;
  const [category, setCategory] = useState<MasterDataCategory>(item?.category ?? defaultCategory);
  const [label, setLabel] = useState(item?.label ?? "");
  const [code, setCode] = useState(item?.code ?? "");
  const [sortOrder, setSortOrder] = useState(item?.sortOrder ?? 0);
  const [status, setStatus] = useState<ActiveStatus>(item?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!label.trim()) {
      setError("Label is required.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        category,
        label: label.trim(),
        code: code.trim() || null,
        sortOrder: Number(sortOrder) || 0,
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
        className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 sm:p-8 animate-[scaleIn_0.25s_ease-out]">
        <button type="button" onClick={onClose} disabled={saving} className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors disabled:opacity-50" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Master Data</span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{editing ? "Edit Item" : "Add Item"}</h3>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Category *</label>
            <select value={category} disabled={editing} onChange={(e) => setCategory(e.target.value as MasterDataCategory)} className={`${INPUT_CLS} ${editing ? "opacity-50" : ""}`}>
              {MASTER_DATA_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{MASTER_DATA_CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Label *</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Dhaka" className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. DAC" className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Sort Order</label>
            <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={INPUT_CLS} />
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
            {saving ? "Saving..." : editing ? "Save Changes" : "Add Item"}
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