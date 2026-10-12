// app/bedward/BedWardModule.tsx
// Live "Bed & Ward Management" module (feature id = 7 in the dashboard).
// Super-admin only. Four branch-scoped setup lists — Floor, Bed Type, Bed Group
// and Bed Status — each backed by GET/POST/PATCH /api/bed-ward/<kind>.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2, FiX } from "react-icons/fi";
import {
  bedWardApi,
  branchApi,
  errorMessage,
  type BedWardItem,
  type BedWardKind,
  type BranchRecord,
  type CreateBedWardInput,
  type PaginationMeta,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const PAGE_SIZE = 10;

const TABS: { kind: BedWardKind; label: string; singular: string; hint: string; placeholder: string }[] = [
  {
    kind: "floors",
    label: "Floor",
    singular: "Floor",
    hint: "Physical floors of the hospital building, e.g. Ground, First, Second.",
    placeholder: "Search floor name or code…",
  },
  {
    kind: "bed-types",
    label: "Bed Type",
    singular: "Bed Type",
    hint: "Classification of beds, e.g. General, Semi-Private, Cabin, ICU.",
    placeholder: "Search bed type name or code…",
  },
  {
    kind: "bed-groups",
    label: "Bed Group",
    singular: "Bed Group",
    hint: "Grouping of beds for allocation, e.g. Male Ward, Female Ward, Pediatric.",
    placeholder: "Search bed group name or code…",
  },
  {
    kind: "bed-statuses",
    label: "Bed Status",
    singular: "Bed Status",
    hint: "Configurable status labels, e.g. Available, Occupied, Reserved, Cleaning.",
    placeholder: "Search bed status name or code…",
  },
];

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

export function BedWardModule({ role }: { role: string | null }) {
  if (role !== "super-admin") {
    return (
      <div className="card p-8 rounded-2xl border border-[var(--border)] shadow-sm text-center space-y-2">
        <h3 className="font-black text-lg text-[var(--primary-dark)]">Super Administrator only</h3>
        <p className="text-xs text-[var(--muted)] max-w-md mx-auto leading-relaxed">
          Bed &amp; Ward Management is restricted to Super Administrators. Please contact your system
          administrator if you need access.
        </p>
      </div>
    );
  }
  return <BedWardManager />;
}

function BedWardManager() {
  const [activeKind, setActiveKind] = useState<BedWardKind>("floors");
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [rows, setRows] = useState<BedWardItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<BedWardItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    let active = true;
    branchApi
      .list({ limit: 100 })
      .then((r) => {
        if (!active) return;
        setBranches(r.data);
        setBranchId((prev) => prev ?? r.data[0]?.id ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (branchId == null) {
      setRows([]);
      setPagination(null);
      setLoading(false);
      return;
    }
    try {
      const result = await bedWardApi.list(activeKind, {
        page,
        limit: PAGE_SIZE,
        search: searchTerm || undefined,
        branchId,
      });
      setRows(result.data);
      setPagination(result.pagination);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeKind, branchId, page, searchTerm]);

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

  const tab = TABS.find((t) => t.kind === activeKind) ?? TABS[0];
  const totalPages = pagination?.totalPages ?? 1;
  const safePage = Math.min(page, Math.max(1, totalPages));

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (item: BedWardItem) => {
    setEditing(item);
    setShowForm(true);
  };

  const submit = async (input: CreateBedWardInput): Promise<void> => {
    if (editing) {
      await bedWardApi.update(activeKind, editing.id, {
        name: input.name,
        description: input.description,
      });
      notify("success", `${tab.singular} "${input.name}" updated.`);
    } else {
      const created = await bedWardApi.create(activeKind, input);
      notify("success", `${tab.singular} "${created.item.name}" created.`);
      setPage(1);
      setSearchTerm("");
      setSearchInput("");
    }
    setShowForm(false);
    setEditing(null);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Bed &amp; Ward Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Setup Lists</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Super-admin managed, branch-scoped reference data used when allocating beds.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3">
          {TABS.map((t) => {
            const active = t.kind === activeKind;
            return (
              <button
                key={t.kind}
                onClick={() => {
                  setActiveKind(t.kind);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  active
                    ? "text-white"
                    : "text-[var(--muted)] border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 hover:text-[var(--text)]"
                }`}
                style={active ? { background: "var(--primary)" } : undefined}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">{tab.label} list</h4>
            <p className="text-xs text-[var(--muted)]">
              {pagination ? `${pagination.total} ${tab.label.toLowerCase()}(s) total` : "Loading…"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={branchId ?? ""}
              onChange={(e) => {
                setBranchId(e.target.value ? Number(e.target.value) : null);
                setPage(1);
              }}
              className={`${INPUT_CLS} w-48`}
            >
              {branches.length === 0 && <option value="">No branches</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={tab.placeholder}
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
              disabled={branchId == null}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--primary)" }}
            >
              <FiPlus className="w-3.5 h-3.5" />
              Add {tab.singular}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[var(--muted)]">{tab.hint}</p>

        {error && (
          <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[640px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                {["Code", "Name", "Description", "Actions"].map((col) => (
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
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-xs text-[var(--muted)]">
                    No {tab.label.toLowerCase()} found.
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="text-[12px] font-bold text-[var(--primary-dark)] px-4 py-3 border-b border-[var(--border)]">
                      {item.code}
                    </td>
                    <td className="text-[12px] font-bold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {item.name}
                    </td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                      {item.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                        title={`Edit ${tab.singular}`}
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
            Showing {rows.length} of {pagination?.total ?? 0} rows
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

      {showForm && branchId != null && (
        <BedWardFormModal
          key={editing?.id ?? "new"}
          singular={tab.singular}
          item={editing}
          branchId={branchId}
          onSubmit={submit}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function BedWardFormModal({
  singular,
  item,
  branchId,
  onSubmit,
  onClose,
}: {
  singular: string;
  item: BedWardItem | null;
  branchId: number;
  onSubmit: (input: CreateBedWardInput) => Promise<void>;
  onClose: () => void;
}) {
  const editing = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const [code, setCode] = useState(item?.code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name is required";
    else if (name.trim().length > 255) next.name = "Must be at most 255 characters";
    if (!editing) {
      if (!code.trim()) next.code = "Code is required";
      else if (code.trim().length > 32) next.code = "Must be at most 32 characters";
    }
    if (description.trim().length > 500) next.description = "Must be at most 500 characters";
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
        branchId,
        name: name.trim(),
        code: code.trim(),
        description: description.trim() || null,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: string) =>
    fieldErrors[key] ? (
      <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors[key]}</p>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
              Bed &amp; Ward Management
            </span>
            <h3 className="font-black text-lg text-[var(--primary-dark)]">
              {editing ? `Edit ${singular}` : `Add ${singular}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            title="Close"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLS}
              placeholder={`${singular} name`}
              autoFocus
            />
            {fieldError("name")}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
              Code {editing ? "(fixed)" : "*"}
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${INPUT_CLS} ${editing ? "opacity-60 cursor-not-allowed" : ""}`}
              placeholder="e.g. GF"
              disabled={editing}
            />
            {fieldError("code")}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${INPUT_CLS} min-h-[72px]`}
              placeholder="Optional notes"
            />
            {fieldError("description")}
          </div>

          {error && (
            <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              style={{ background: "var(--primary)" }}
            >
              {saving ? "Saving…" : editing ? "Save changes" : `Add ${singular}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
