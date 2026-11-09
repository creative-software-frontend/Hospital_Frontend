"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiPlus, FiRefreshCcw, FiTrash2, FiArrowLeft } from "react-icons/fi";
import {
  bedTransferApi,
  errorMessage,
  type BedTransferRecord,
  type CreateBedTransferInput,
} from "@/app/lib/api";
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

export function BedTransferPage({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<BedTransferRecord[]>([]);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  // Transfer form
  const [patientId, setPatientId] = useState<number | null>(null);
  const [fromBedId, setFromBedId] = useState<number | null>(null);
  const [toBedId, setToBedId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const notify = useCallback((message: string, kind: ToastItem["kind"] = "success") => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current.slice(-3), { id, kind, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  // Load bed transfers
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      bedTransferApi
        .list({
          page,
          limit: PAGE_SIZE,
        })
        .then((result) => {
          if (!active) return;
          setRows(result.data);
          setPagination(result.pagination);
          setError("");
        })
        .catch((err) => {
          if (active) setError(errorMessage(err));
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
    if (!patientId) {
      setFieldErrors({ patientId: "Patient ID is required" });
      return;
    }
    if (!fromBedId) {
      setFieldErrors({ fromBedId: "Source bed ID is required" });
      return;
    }
    if (!toBedId) {
      setFieldErrors({ toBedId: "Destination bed ID is required" });
      return;
    }
    if (fromBedId === toBedId) {
      setFieldErrors({ toBedId: "Source and destination beds must be different" });
      return;
    }

    const payload: CreateBedTransferInput = {
      patientId,
      admissionId: null, // Backend resolves active admission automatically
      fromBedId,
      toBedId,
      reason: reason.trim() || null,
      notes: notes.trim() || null,
    };

    setSaving(true);
    setFormError("");
    setFieldErrors({});
    try {
      await bedTransferApi.create(payload);
      notify("Bed transfer recorded successfully.");
      setPatientId(null);
      setFromBedId(null);
      setToBedId(null);
      setReason("");
      setNotes("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: BedTransferRecord) => {
    if (!window.confirm(`Delete the bed transfer for ${row.patient.name} (${row.fromBed.bedNumber} → ${row.toBed.bedNumber})?`)) return;
    try {
      await bedTransferApi.remove(row.id);
      setReloadKey((k) => k + 1);
      notify("Bed transfer deleted.");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const totalPages = pagination?.totalPages ?? 1;
  const safePage = Math.min(page, Math.max(1, totalPages));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button
            onClick={onBack}
            className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] cursor-pointer"
          >
            <FiArrowLeft className="w-3 h-3 mr-1" />
            ← Back to Bed & Ward Management
          </button>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <FiPlus className="w-5 h-5 text-[var(--primary-dark)]" />
          <span className="text-xs font-extrabold tracking-widest text-[var(--muted)] uppercase">
            Bed & Ward Management
          </span>
          <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Bed Transfer</h3>
        </div>
      </div>

      {/* Transfer form */}
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Transfer Bed</h4>
            <p className="text-xs text-[var(--muted)]">
              Move an admitted patient from one bed to another. The backend resolves
              the patient&rsquo;s active admission automatically.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl">
          <label className="text-[11px] font-bold text-[var(--muted)]">
            Patient ID *
            <input
              type="number"
              value={patientId ?? ""}
              onChange={(e) => setPatientId(e.target.value ? Number(e.target.value) : null)}
              placeholder="Patient ID"
              className={`${INPUT_CLS} mt-1`}
            />
            {fieldErrors.patientId && (
              <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.patientId}</p>
            )}
          </label>
          <label className="text-[11px] font-bold text-[var(--muted)]">
            From Bed ID *
            <input
              type="number"
              value={fromBedId ?? ""}
              onChange={(e) => setFromBedId(e.target.value ? Number(e.target.value) : null)}
              placeholder="Source bed ID"
              className={`${INPUT_CLS} mt-1`}
            />
            {fieldErrors.fromBedId && (
              <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.fromBedId}</p>
            )}
          </label>
          <label className="text-[11px] font-bold text-[var(--muted)]">
            To Bed ID *
            <input
              type="number"
              value={toBedId ?? ""}
              onChange={(e) => setToBedId(e.target.value ? Number(e.target.value) : null)}
              placeholder="Destination bed ID"
              className={`${INPUT_CLS} mt-1`}
            />
            {fieldErrors.toBedId && (
              <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.toBedId}</p>
            )}
          </label>
          <label className="text-[11px] font-bold text-[var(--muted)] sm:col-span-2 lg:col-span-2">
            Reason
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Reason for transfer (e.g., patient needs ICU care)"
              className={`${INPUT_CLS} mt-1 resize-none`}
            />
            {fieldErrors.reason && (
              <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.reason}</p>
            )}
          </label>
          <label className="text-[11px] font-bold text-[var(--muted)] sm:col-span-2 lg:col-span-2">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Additional notes"
              className={`${INPUT_CLS} mt-1 resize-none`}
            />
          </label>
        </div>

        {formError && <p className="text-sm alert-error">{formError}</p>}

        <div className="flex items-center gap-2">
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            {saving ? "Transferring…" : "Transfer Bed"}
          </button>
          <button
            onClick={() => {
              setPatientId(null);
              setFromBedId(null);
              setToBedId(null);
              setReason("");
              setNotes("");
              setFieldErrors({});
              setFormError("");
            }}
            className="px-4 py-2 rounded-lg text-xs font-bold border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Transfer history */}
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Transfer History</h4>
            <p className="text-xs text-[var(--muted)]">
              {pagination?.total ?? 0} transfer(s) recorded
            </p>
          </div>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="p-2.5 rounded-xl border border-[var(--border)] text-[var(--muted)] cursor-pointer"
            title="Refresh"
          >
            <FiRefreshCcw className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <p className="text-sm alert-error">{error}</p>
        )}

        {loading ? (
          <p className="text-xs text-[var(--muted)]">Loading transfers…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
            <FiPlus className="w-6 h-6 mx-auto mb-2 text-[var(--muted)] opacity-50" />
            <p className="text-xs font-bold text-[var(--muted)]">
              No bed transfers recorded yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[var(--bg)]">
                  <th className="py-3 pr-4">Date & Time</th>
                  <th className="py-3 pr-4">Patient</th>
                  <th className="py-3 pr-4">Admission</th>
                  <th className="py-3 pr-4">From → To</th>
                  <th className="py-3 pr-4">Reason</th>
                  <th className="py-3 pr-4">By</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 pr-4 text-[11px] font-bold text-[var(--text)]">
                      {formatDateTime(row.transferDate)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-bold text-[var(--text)]">{row.patient.name}</span>
                      <br />
                      <span className="text-[10px] text-[var(--muted)]">{row.patient.patientCode}</span>
                    </td>
                    <td className="py-3 pr-4 text-[11px] text-[var(--muted)]">
                      {row.admission.admissionNumber}
                      <br />
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold border-slate-200`}>
                        {row.admission.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[11px] text-[var(--text)]">
                      {row.fromBed.bedNumber}
                      <span className="text-[var(--muted)]"> → </span>
                      {row.toBed.bedNumber}
                    </td>
                    <td className="py-3 pr-4 text-[11px] text-[var(--muted)]">
                      {row.reason || "—"}
                    </td>
                    <td className="py-3 pr-4 text-[11px] text-[var(--muted)]">
                      {row.createdBy?.name || "—"}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => remove(row)}
                        className="text-rose-500 hover:text-rose-600 cursor-pointer"
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-[var(--muted)]">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border)] disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border)] disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
