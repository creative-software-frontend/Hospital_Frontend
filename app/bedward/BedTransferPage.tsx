"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiRefreshCcw, FiTrash2, FiArrowLeft } from "react-icons/fi";
import { MdKingBed } from "react-icons/md";
import {
  bedBoardApi,
  bedTransferApi,
  branchApi,
  errorMessage,
  patientApi,
  type BedBoard,
  type BedBoardBed,
  type BedTransferRecord,
  type CreateBedTransferInput,
  type PatientListRecord,
} from "@/app/lib/api";
import { PatientSearchPicker } from "@/app/patients/PatientSearchPicker";
import { ToastViewport, type ToastItem } from "@/app/patients/Toast";

const PAGE_SIZE = 10;

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface FlatBed {
  id: number;
  name: string;
  status: string;
  floor: string;
  group: string;
}

function flattenBeds(board: BedBoard | null): FlatBed[] {
  const out: FlatBed[] = [];
  if (!board) return out;
  for (const floor of board.floors) {
    for (const ward of floor.wards) {
      for (const bed of ward.beds) {
        out.push({ id: bed.id, name: bed.name, status: bed.status, floor: floor.name, group: ward.name });
      }
    }
  }
  return out;
}

function BedTile({
  bed,
  selected,
  disabled,
  onClick,
}: {
  bed: FlatBed;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const color =
    bed.status === "AVAILABLE"
      ? "text-emerald-500"
      : bed.status === "OCCUPIED"
      ? "text-rose-500"
      : "text-slate-400";
  const label =
    bed.status === "AVAILABLE" ? "Available" : bed.status === "OCCUPIED" ? "Occupied" : "Unused";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={`${bed.name} — ${label} (${bed.group}, ${bed.floor})`}
      className={`flex flex-col items-center gap-1 w-20 rounded-xl border p-2 transition-colors ${
        selected
          ? "border-[var(--primary)] bg-[var(--primary-soft)]/30"
          : "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--primary)]/50"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <MdKingBed className={`w-8 h-8 ${color}`} />
      <span className="text-[9px] font-mono text-[var(--muted)]">#{bed.id}</span>
      <span className="text-[10px] font-bold text-[var(--primary-dark)] truncate w-full text-center">
        {bed.name}
      </span>
      <span
        className={`text-[9px] font-bold ${
          bed.status === "AVAILABLE"
            ? "text-emerald-600"
            : bed.status === "OCCUPIED"
            ? "text-rose-500"
            : "text-slate-500"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function BedTransferPage({ onBack }: { onBack?: () => void }) {
  const [rows, setRows] = useState<BedTransferRecord[]>([]);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  // Transfer form
  const [selectedPatient, setSelectedPatient] = useState<PatientListRecord | null>(null);
  const [fromBedId, setFromBedId] = useState<number | null>(null);
  const [toBedId, setToBedId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  // Beds
  const [beds, setBeds] = useState<FlatBed[]>([]);
  const [bedsLoading, setBedsLoading] = useState(false);
  const [bedsError, setBedsError] = useState("");
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);

  const notify = useCallback((message: string, kind: ToastItem["kind"] = "success") => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current.slice(-3), { id, kind, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const loadBeds = useCallback(async (bid?: number | null) => {
    setBedsLoading(true);
    setBedsError("");
    try {
      const result = await bedBoardApi.get(bid ?? undefined);
      setBeds(flattenBeds(result.board));
      setBranchId((prev) => prev ?? result.board.branchId);
    } catch (err) {
      setBedsError(err instanceof Error ? err.message : "Could not load beds");
    } finally {
      setBedsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    branchApi
      .list({ limit: 100 })
      .then((r) => {
        if (active) setBranches(r.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadBeds(branchId);
  }, [loadBeds, branchId]);

  // Load bed transfers
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      bedTransferApi
        .list({ page, limit: PAGE_SIZE })
        .then((result) => {
          if (!active) return;
          setRows(result.data);
          setPagination(result.pagination);
          setError("");
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : "Could not load transfers");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page, reloadKey]);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!selectedPatient) next.patientId = "Patient is required";
    if (!fromBedId) next.fromBedId = "Source bed is required";
    if (!toBedId) next.toBedId = "Destination bed is required";
    if (fromBedId && toBedId && fromBedId === toBedId) next.toBedId = "Source and destination must differ";
    setFieldErrors(next);
    if (Object.keys(next).length) return;

    const payload: CreateBedTransferInput = {
      patientId: selectedPatient!.id,
      admissionId: null,
      fromBedId: fromBedId as number,
      toBedId: toBedId as number,
      reason: reason.trim() || null,
      notes: notes.trim() || null,
    };

    setSaving(true);
    setFormError("");
    try {
      await bedTransferApi.create(payload);
      notify("Bed transfer recorded successfully.");
      setSelectedPatient(null);
      setFromBedId(null);
      setToBedId(null);
      setReason("");
      setNotes("");
      setReloadKey((k) => k + 1);
      loadBeds(branchId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not record transfer");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: BedTransferRecord) => {
    if (!window.confirm(`Delete the bed transfer for ${row.patient.name} (${row.fromBedDefinition.name} → ${row.toBedDefinition.name})?`)) return;
    try {
      await bedTransferApi.remove(row.id);
      setReloadKey((k) => k + 1);
      notify("Bed transfer deleted.");
      loadBeds(branchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete transfer");
    }
  };

  const totalPages = pagination?.totalPages ?? 1;
  const safePage = Math.min(page, Math.max(1, totalPages));

  const fromBed = beds.find((b) => b.id === fromBedId);
  const toBed = beds.find((b) => b.id === toBedId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button
            onClick={onBack}
            className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] cursor-pointer"
          >
            <FiArrowLeft className="w-3 h-3 mr-1 inline" />
            ← Back to Bed & Ward Management
          </button>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs font-extrabold tracking-widest text-[var(--muted)] uppercase">
            Bed & Ward Management
          </span>
          <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Bed Transfer</h3>
        </div>
      </div>

      {/* Transfer form */}
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div>
          <h4 className="text-sm font-extrabold text-[var(--text)]">Transfer Bed</h4>
          <p className="text-xs text-[var(--muted)]">
            Move an admitted patient from one bed to another. Select the patient and click the source and
            destination beds below.
          </p>
        </div>

        {branches.length > 1 && (
          <div className="max-w-3xl">
            <label className="text-[11px] font-bold text-[var(--muted)] block mb-1">Branch</label>
            <select
              value={branchId ?? ""}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : null)}
              className={INPUT_CLS}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="max-w-3xl">
          <label className="text-[11px] font-bold text-[var(--muted)] block mb-1">Patient *</label>
          <PatientSearchPicker
            title="Select patient"
            description="Search and pick the patient to transfer."
            selectedId={selectedPatient?.id ?? null}
            onPick={(p) => {
              setSelectedPatient(p);
              setFieldErrors((prev) => ({ ...prev, patientId: "" }));
            }}
          />
          {fieldErrors.patientId && (
            <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.patientId}</p>
          )}
          {selectedPatient && (
            <p className="text-[11px] text-[var(--muted)] mt-1">
              Selected: <span className="font-bold text-[var(--text)]">{selectedPatient.name}</span>{" "}
              ({selectedPatient.patientCode})
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-[var(--muted)]">Source bed (occupied) *</label>
          {bedsError && <p className="text-sm alert-error">{bedsError}</p>}
          {bedsLoading ? (
            <p className="text-xs text-[var(--muted)]">Loading beds…</p>
          ) : beds.filter((b) => b.status === "OCCUPIED").length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No occupied beds available.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {beds
                .filter((b) => b.status === "OCCUPIED")
                .map((bed) => (
                  <BedTile
                    key={bed.id}
                    bed={bed}
                    selected={fromBedId === bed.id}
                    disabled={false}
                    onClick={() => {
                      setFromBedId(bed.id);
                      setFieldErrors((prev) => ({ ...prev, fromBedId: "" }));
                    }}
                  />
                ))}
            </div>
          )}
          {fieldErrors.fromBedId && (
            <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.fromBedId}</p>
          )}
          {fromBed && (
            <p className="text-[11px] text-[var(--muted)]">
              Source: <span className="font-bold text-[var(--text)]">{fromBed.name}</span> (#{fromBed.id})
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-[var(--muted)]">Destination bed (available) *</label>
          {bedsLoading ? (
            <p className="text-xs text-[var(--muted)]">Loading beds…</p>
          ) : beds.filter((b) => b.status === "AVAILABLE").length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No available beds.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {beds
                .filter((b) => b.status === "AVAILABLE")
                .map((bed) => (
                  <BedTile
                    key={bed.id}
                    bed={bed}
                    selected={toBedId === bed.id}
                    disabled={fromBedId === bed.id}
                    onClick={() => {
                      if (fromBedId === bed.id) return;
                      setToBedId(bed.id);
                      setFieldErrors((prev) => ({ ...prev, toBedId: "" }));
                    }}
                  />
                ))}
            </div>
          )}
          {fieldErrors.toBedId && (
            <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.toBedId}</p>
          )}
          {toBed && (
            <p className="text-[11px] text-[var(--muted)]">
              Destination: <span className="font-bold text-[var(--text)]">{toBed.name}</span> (#{toBed.id})
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
          <label className="text-[11px] font-bold text-[var(--muted)]">
            Reason
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for transfer (e.g., patient needs ICU care)"
              className={`${INPUT_CLS} mt-1`}
            />
          </label>
          <label className="text-[11px] font-bold text-[var(--muted)]">
            Notes
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes"
              className={`${INPUT_CLS} mt-1`}
            />
          </label>
        </div>

        {formError && <p className="text-sm alert-error">{formError}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={saving}
            className="h-10 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            {saving ? "Saving…" : "Transfer Bed"}
          </button>
          <button
            onClick={() => {
              setSelectedPatient(null);
              setFromBedId(null);
              setToBedId(null);
              setReason("");
              setNotes("");
              setFieldErrors({});
              setFormError("");
            }}
            className="h-10 rounded-xl px-4 text-xs font-bold border border-[var(--border)] text-[var(--muted)] cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* History */}
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h4 className="text-sm font-extrabold">Transfer History</h4>
            <p className="text-xs text-[var(--muted)]">{pagination?.total ?? 0} transfer(s)</p>
          </div>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="h-10 w-10 rounded-xl border border-[var(--border)] text-[var(--muted)] cursor-pointer"
            title="Refresh"
          >
            <FiRefreshCcw className="mx-auto w-4 h-4" />
          </button>
        </div>
        {error && <p className="text-sm alert-error">{error}</p>}
        {loading ? (
          <p className="text-xs text-[var(--muted)]">Loading transfers…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No bed transfers recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-3 pr-4">Time</th>
                  <th className="py-3 pr-4">Patient</th>
                  <th className="py-3 pr-4">Bed</th>
                  <th className="py-3 pr-4">Reason</th>
                  <th className="py-3 pr-4">Notes</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 pr-4 text-[var(--muted)]">{formatDateTime(row.transferDate)}</td>
                    <td className="py-3 pr-4 font-bold text-[var(--primary-dark)]">
                      {row.patient.name}
                      <span className="block text-[10px] font-normal text-[var(--muted)]">{row.patient.patientCode}</span>
                    </td>
                    <td className="py-3 pr-4 text-[11px] text-[var(--text)]">
                      {row.fromBedDefinition.name}
                      <span className="text-[var(--muted)]"> → </span>
                      {row.toBedDefinition.name}
                    </td>
                    <td className="py-3 pr-4 text-[var(--muted)]">{row.reason || "—"}</td>
                    <td className="py-3 pr-4 text-[var(--muted)]">{row.notes || "—"}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => remove(row)}
                        className="inline-flex items-center gap-1 text-rose-500 font-bold cursor-pointer"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border)] disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs text-[var(--muted)]">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border)] disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
