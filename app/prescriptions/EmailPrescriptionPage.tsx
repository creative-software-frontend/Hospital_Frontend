"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiMail, FiRefreshCcw, FiSearch } from "react-icons/fi";
import {
  errorMessage,
  formatDate,
  prescriptionApi,
  type PaginationMeta,
  type PrescriptionListRow,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";
import { buildPrescriptionEmail, modelFromRecord } from "./printPrescriptionHtml";

const PAGE_SIZE = 10;

export function EmailPrescriptionPage({ onBack }: { onBack?: () => void }) {
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
  const [emailingId, setEmailingId] = useState<number | null>(null);
  // Fallback email modal (used when the patient has no email on file)
  const [emailRow, setEmailRow] = useState<PrescriptionListRow | null>(null);
  const [emailInput, setEmailInput] = useState("");
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

  const sendEmail = async (id: number, to: string) => {
    setEmailingId(id);
    try {
      const detail = await prescriptionApi.get(id);
      const { subject, body } = buildPrescriptionEmail(modelFromRecord(detail));
      const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(body)}`;
      window.location.assign(href);
      notify("success", `Opening your email app for ${detail.prescriptionNumber}.`);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setEmailingId(null);
    }
  };

  const handleEmail = (row: PrescriptionListRow) => {
    if (row.patient.email && row.patient.email.includes("@")) {
      void sendEmail(row.id, row.patient.email);
    } else {
      setEmailRow(row);
      setEmailInput("");
    }
  };

  const submitEmailModal = () => {
    const to = emailInput.trim();
    if (!to.includes("@")) {
      notify("error", "Enter a valid email address.");
      return;
    }
    if (emailRow) void sendEmail(emailRow.id, to);
    setEmailRow(null);
  };

  return (
    <div className="space-y-6">
      {onBack && (
        <button
          onClick={onBack}
          className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] cursor-pointer"
        >
          ← Back to Prescription Management
        </button>
      )}

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Prescription Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Email Prescription</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">
          All saved prescriptions. Use the email button to send a prescription to the patient.
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
                    <th className="text-left py-2.5 px-3">Email</th>
                    <th className="text-left py-2.5 px-3">Doctor</th>
                    <th className="text-left py-2.5 px-3">Date</th>
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
                      <td className="py-2 px-3 text-[var(--muted)]">
                        {row.patient.email || "—"}
                      </td>
                      <td className="py-2 px-3 text-[var(--muted)]">{row.doctor.name}</td>
                      <td className="py-2 px-3 text-[var(--muted)]">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => handleEmail(row)}
                          disabled={emailingId === row.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white cursor-pointer disabled:opacity-50"
                          style={{ background: "var(--primary)" }}
                        >
                          <FiMail className="w-3 h-3" />
                          {emailingId === row.id ? "Preparing…" : "Email"}
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

      {emailRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEmailRow(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[var(--card)] p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className="font-black text-lg text-[var(--primary-dark)]">
              Send {emailRow.prescriptionNumber}
            </h4>
            <p className="text-xs text-[var(--muted)] mt-1 mb-3">
              No email on file for {emailRow.patient.name}. Enter an address to send it.
            </p>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitEmailModal();
              }}
              placeholder="patient@example.com"
              className="w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)]"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setEmailRow(null)}
                className="h-9 px-4 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--muted)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEmailModal}
                className="h-9 px-4 rounded-xl text-xs font-bold text-white cursor-pointer"
                style={{ background: "var(--primary)" }}
              >
                Open Email
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastViewport
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))}
      />
    </div>
  );
}