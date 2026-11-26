"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiPrinter, FiRefreshCcw, FiSearch } from "react-icons/fi";
import {
  errorMessage,
  formatDate,
  prescriptionApi,
  type PaginationMeta,
  type PrescriptionListRow,
  type PrescriptionStatus,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";
import { buildPrescriptionHtml, modelFromRecord, openPrintWindow } from "./printPrescriptionHtml";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<PrescriptionStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PARTIALLY_DISPENSED: "bg-amber-50 text-amber-700",
  DISPENSED: "bg-sky-50 text-sky-700",
  CANCELLED: "bg-slate-100 text-slate-600",
};

export function PrintPrescriptionPage({ onBack }: { onBack?: () => void }) {
  const [rows, setRows] = useState<PrescriptionListRow[]>([]);
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
  const [printingId, setPrintingId] = useState<number | null>(null);
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
        const result = await prescriptionApi.list({
          search: appliedSearch || undefined,
          page,
          limit: PAGE_SIZE,
        });
        setRows(result.data);
        setPagination(result.pagination);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [appliedSearch, page, reloadKey]);

  const handlePrint = async (row: PrescriptionListRow) => {
    setPrintingId(row.id);
    try {
      const detail = await prescriptionApi.get(row.id);
      const html = buildPrescriptionHtml(modelFromRecord(detail));
      if (!openPrintWindow(html)) {
        notify("error", "Please allow pop-ups to print the prescription.");
      }
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        {onBack && (
          <button
            onClick={onBack}
            className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] cursor-pointer"
          >
            ← Back to Prescription Management
          </button>
        )}

        <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm mt-4">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
            Prescription Management
          </span>
          <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
            Print Prescription
          </h3>
          <p className="text-xs text-[var(--muted)] mt-1.5">
            All saved prescriptions. Use the print button to print any prescription.
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
                placeholder="Search by Rx number, patient or doctor..."
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
          </div>

          {error && <p className="text-sm alert-error">{error}</p>}

          {loading ? (
            <p className="text-xs text-[var(--muted)] py-4">Loading prescriptions…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-[var(--muted)] py-4">
              {appliedSearch
                ? "No prescriptions match this search."
                : "No prescriptions saved yet. Create one from Digital Prescription."}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--bg)] text-[var(--muted)]">
                      <th className="text-left py-2.5 px-3">Rx No</th>
                      <th className="text-left py-2.5 px-3">Patient</th>
                      <th className="text-left py-2.5 px-3">Doctor</th>
                      <th className="text-left py-2.5 px-3">Date</th>
                      <th className="text-left py-2.5 px-3">Medicines</th>
                      <th className="text-left py-2.5 px-3">Status</th>
                      <th className="text-left py-2.5 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--border)]">
                        <td className="py-2 px-3 font-bold text-[var(--primary-dark)]">
                          {row.prescriptionNumber}
                        </td>
                        <td className="py-2 px-3 font-semibold text-[var(--text)]">
                          {row.patient.name}
                          <span className="block text-[10px] text-[var(--muted)]">
                            {row.patient.patientCode}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[var(--muted)]">{row.doctor.name}</td>
                        <td className="py-2 px-3 text-[var(--muted)]">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="py-2 px-3 text-[var(--muted)]">{row.items.length}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[row.status] ?? "bg-slate-100 text-slate-600"}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            onClick={() => handlePrint(row)}
                            disabled={printingId === row.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white cursor-pointer disabled:opacity-50"
                            style={{ background: "var(--primary)" }}
                          >
                            <FiPrinter className="w-3 h-3" />
                            {printingId === row.id ? "Loading…" : "Print"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-[11px] text-[var(--muted)]">
                  <span>
                    Page {pagination.page} of {pagination.totalPages} · {pagination.total}{" "}
                    prescriptions
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

        <ToastViewport
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))}
        />
      </div>
    </div>
  );
}