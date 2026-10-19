// app/bedward/BedWardModule.tsx
// Live "Bed & Ward Management" module (feature id = 7 in the dashboard).
// Super-admin only, branch-scoped. Setup tabs — Floor, Bed Type, Bed Group and
// Bed — are backed by GET/POST/PATCH /api/bed-ward/<kind>; the Bed Status tab
// is a read-only overview of the beds with their type, group, floor and status.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2, FiX } from "react-icons/fi";
import {
  bedWardApi,
  branchApi,
  errorMessage,
  type BedWardItem,
  type BedWardKind,
  type BedOccupancyStatus,
  type BranchRecord,
  type CreateBedWardInput,
  type PaginationMeta,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const PAGE_SIZE = 10;

interface TabConfig {
  id: string;
  /** API kind the tab reads from / writes to. */
  kind: BedWardKind;
  label: string;
  singular: string;
  hint: string;
  placeholder: string;
  columns: string[];
  /** Read-only tabs (e.g. Bed Status) list rows but cannot add/edit them. */
  readOnly?: boolean;
}

const TABS: TabConfig[] = [
  {
    id: "bed-statuses",
    kind: "beds",
    label: "Bed Status",
    singular: "Bed",
    hint: "Every bed with its bed type, bed group, floor and availability status.",
    placeholder: "Search bed name…",
    columns: ["Name", "Bed Type", "Bed Group", "Floor", "Status"],
    readOnly: true,
  },
  {
    id: "beds",
    kind: "beds",
    label: "Bed",
    singular: "Bed",
    hint: "Individual beds, each assigned a bed type and a bed group.",
    placeholder: "Search bed name…",
    columns: ["Name", "Bed Type", "Bed Group", "Availability"],
  },
  {
    id: "bed-types",
    kind: "bed-types",
    label: "Bed Type",
    singular: "Bed Type",
    hint: "Classification of beds, e.g. General, Semi-Private, Cabin, ICU.",
    placeholder: "Search bed type name…",
    columns: ["Name"],
  },
  {
    id: "bed-groups",
    kind: "bed-groups",
    label: "Bed Group",
    singular: "Bed Group",
    hint: "Grouping of beds for allocation, e.g. Male Ward, Female Ward, Pediatric.",
    placeholder: "Search bed group name…",
    columns: ["Name", "Floor", "Color", "Description"],
  },
  {
    id: "floors",
    kind: "floors",
    label: "Floor",
    singular: "Floor",
    hint: "Physical floors of the hospital building, e.g. Ground, First, Second.",
    placeholder: "Search floor name…",
    columns: ["Name", "Description"],
  },
];

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

interface FormPayload {
  name: string;
  description?: string | null;
  color?: string | null;
  floorId?: number;
  bedTypeId?: number;
  bedGroupId?: number;
  status?: BedOccupancyStatus;
}

export function BedWardModule({ role, defaultBranchId }: { role: string | null; defaultBranchId?: number | null }) {
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
  return <BedWardManager defaultBranchId={defaultBranchId} />;
}

function BedWardManager({ defaultBranchId }: { defaultBranchId?: number | null }) {
  const [activeTabId, setActiveTabId] = useState<string>("bed-statuses");
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

  const tab = TABS.find((t) => t.id === activeTabId) ?? TABS[0];
  const sourceKind = tab.kind;

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
        // Prefer the caller's own branch so new rows are not silently saved to
        // whichever branch happens to sort first.
        setBranchId((prev) => prev ?? (defaultBranchId ?? r.data[0]?.id) ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [defaultBranchId]);

  const load = useCallback(async () => {
    const kind = (TABS.find((t) => t.id === activeTabId) ?? TABS[0]).kind;
    if (branchId == null) {
      setRows([]);
      setPagination(null);
      setLoading(false);
      return;
    }
    try {
      const result = await bedWardApi.list(kind, {
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
  }, [activeTabId, branchId, page, searchTerm]);

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
  const colSpan = tab.columns.length + (tab.readOnly ? 0 : 1);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (item: BedWardItem) => {
    setEditing(item);
    setShowForm(true);
  };

  const submit = async (payload: FormPayload): Promise<void> => {
    if (editing) {
      await bedWardApi.update(sourceKind, editing.id, payload);
      notify("success", `${tab.singular} "${payload.name}" updated.`);
    } else {
      const created = await bedWardApi.create(sourceKind, {
        branchId: branchId as number,
        ...payload,
      } as CreateBedWardInput);
      notify("success", `${tab.singular} "${created.item.name}" created.`);
      setPage(1);
      setSearchTerm("");
      setSearchInput("");
    }
    setShowForm(false);
    setEditing(null);
    setReloadKey((k) => k + 1);
  };

  const renderCells = (item: BedWardItem): React.ReactNode[] => {
    const bold = (v: React.ReactNode) => (
      <span className="font-bold text-[var(--primary-dark)]">{v}</span>
    );
    const muted = (v: React.ReactNode) => <span className="text-[var(--muted)]">{v}</span>;

    const statusBadge = (status?: BedOccupancyStatus) => {
      const styles: Record<BedOccupancyStatus, string> = {
        AVAILABLE: "bg-emerald-500/15 text-emerald-600 border-emerald-400/30",
        OCCUPIED: "bg-rose-500/15 text-rose-500 border-rose-400/30",
        UNUSED: "bg-slate-500/15 text-slate-500 border-slate-400/30",
      };
      const labels: Record<BedOccupancyStatus, string> = {
        AVAILABLE: "Available",
        OCCUPIED: "Occupied",
        UNUSED: "Unused",
      };
      const key: BedOccupancyStatus = status ?? "AVAILABLE";
      return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[key]}`}>
          {labels[key]}
        </span>
      );
    };

    let nodes: React.ReactNode[] = [];
    switch (tab.id) {
      case "floors":
        nodes = [bold(item.name), muted(item.description ?? "—")];
        break;
      case "bed-types":
        nodes = [bold(item.name)];
        break;
      case "bed-groups":
        nodes = [
          bold(item.name),
          item.floor?.name ?? "—",
          item.color ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-full border border-[var(--border)]"
                style={{ background: item.color }}
              />
              <span className="text-[var(--muted)]">{item.color}</span>
            </span>
          ) : (
            "—"
          ),
          muted(item.description ?? "—"),
        ];
        break;
      case "bed-statuses":
        nodes = [
          bold(item.name),
          item.bedType?.name ?? "—",
          item.bedGroup?.name ?? "—",
          item.bedGroup?.floor?.name ?? "—",
          statusBadge(item.status),
        ];
        break;
      case "beds":
        nodes = [
          bold(item.name),
          item.bedType?.name ?? "—",
          item.bedGroup?.name ?? "—",
          statusBadge(item.status),
        ];
        break;
    }
    return nodes.map((n, i) => (
      <td key={i} className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
        {n}
      </td>
    ));
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
            const active = t.id === activeTabId;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTabId(t.id);
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
            {!tab.readOnly && (
              <button
                onClick={openCreate}
                disabled={branchId == null}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--primary)" }}
              >
                <FiPlus className="w-3.5 h-3.5" />
                Add {tab.singular}
              </button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-[var(--muted)]">{tab.hint}</p>

        {error && (
          <p className="text-sm alert-error">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[640px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                {[...tab.columns, ...(tab.readOnly ? [] : ["Actions"])].map((col) => (
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
                  <td colSpan={colSpan} className="px-4 py-10 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center text-xs text-[var(--muted)]">
                    No {tab.label.toLowerCase()} found.
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    {renderCells(item)}
                    {!tab.readOnly && (
                      <td className="px-4 py-3 border-b border-[var(--border)]">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                          title={`Edit ${tab.singular}`}
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
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
          key={`${activeTabId}-${editing?.id ?? "new"}`}
          kind={sourceKind}
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
  kind,
  singular,
  item,
  branchId,
  onSubmit,
  onClose,
}: {
  kind: BedWardKind;
  singular: string;
  item: BedWardItem | null;
  branchId: number;
  onSubmit: (payload: FormPayload) => Promise<void>;
  onClose: () => void;
}) {
  const editing = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [color, setColor] = useState(item?.color ?? "");
  const [floorId, setFloorId] = useState<number | null>(item?.floorId ?? null);
  const [bedTypeId, setBedTypeId] = useState<number | null>(item?.bedTypeId ?? null);
  const [bedGroupId, setBedGroupId] = useState<number | null>(item?.bedGroupId ?? null);
  const [status, setStatus] = useState<BedOccupancyStatus>(item?.status ?? "AVAILABLE");
  const [floors, setFloors] = useState<BedWardItem[]>([]);
  const [bedTypes, setBedTypes] = useState<BedWardItem[]>([]);
  const [bedGroups, setBedGroups] = useState<BedWardItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        if (kind === "bed-groups") {
          const r = await bedWardApi.list("floors", { limit: 100, branchId });
          if (active) setFloors(r.data);
        } else if (kind === "beds") {
          const t = await bedWardApi.list("bed-types", { limit: 100, branchId });
          if (active) setBedTypes(t.data);
          const g = await bedWardApi.list("bed-groups", { limit: 100, branchId });
          if (active) setBedGroups(g.data);
        }
      } catch {
        /* options are best-effort; a failed load just leaves the select empty */
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [kind, branchId]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name is required";
    else if (name.trim().length > 255) next.name = "Must be at most 255 characters";
    if (kind === "floors" || kind === "bed-groups") {
      if (description.trim().length > 500) next.description = "Must be at most 500 characters";
    }
    if (kind === "bed-groups") {
      if (floorId == null) next.floorId = "Floor is required";
      if (color.trim().length > 20) next.color = "Must be at most 20 characters";
    }
    if (kind === "beds") {
      if (bedTypeId == null) next.bedTypeId = "Bed Type is required";
      if (bedGroupId == null) next.bedGroupId = "Bed Group is required";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = (): FormPayload => {
    const payload: FormPayload = { name: name.trim() };
    if (kind === "floors") {
      payload.description = description.trim() || null;
    } else if (kind === "bed-groups") {
      payload.floorId = floorId ?? undefined;
      payload.color = color.trim() || null;
      payload.description = description.trim() || null;
    } else if (kind === "beds") {
      payload.bedTypeId = bedTypeId ?? undefined;
      payload.bedGroupId = bedGroupId ?? undefined;
      payload.status = status;
    }
    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setSaving(true);
    try {
      await onSubmit(buildPayload());
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

  const selectCls = `${INPUT_CLS} disabled:opacity-60`;

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

          {kind === "bed-groups" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  Floor *
                </label>
                <select
                  value={floorId ?? ""}
                  onChange={(e) => setFloorId(e.target.value ? Number(e.target.value) : null)}
                  className={selectCls}
                >
                  <option value="">Select floor…</option>
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {fieldError("floorId")}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color || "#4f46e5"}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 w-10 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] cursor-pointer"
                    title="Pick a color"
                  />
                  <input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className={INPUT_CLS}
                    placeholder="#4f46e5 (optional)"
                  />
                </div>
                {fieldError("color")}
              </div>
            </div>
          )}

          {kind === "beds" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  Bed Type *
                </label>
                <select
                  value={bedTypeId ?? ""}
                  onChange={(e) => setBedTypeId(e.target.value ? Number(e.target.value) : null)}
                  className={selectCls}
                >
                  <option value="">Select bed type…</option>
                  {bedTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {fieldError("bedTypeId")}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  Bed Group *
                </label>
                <select
                  value={bedGroupId ?? ""}
                  onChange={(e) => setBedGroupId(e.target.value ? Number(e.target.value) : null)}
                  className={selectCls}
                >
                  <option value="">Select bed group…</option>
                  {bedGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {fieldError("bedGroupId")}
              </div>
            </div>
          )}

          {(kind === "floors" || kind === "bed-groups") && (
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${INPUT_CLS} min-h-[72px]`}
                placeholder="Optional notes"
              />
              {fieldError("description")}
            </div>
          )}

          {kind === "beds" && (
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BedOccupancyStatus)}
                className={INPUT_CLS}
              >
                <option value="AVAILABLE">Available</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="UNUSED">Unused</option>
              </select>
            </div>
          )}

          {error && (
            <p className="text-sm alert-error">
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
