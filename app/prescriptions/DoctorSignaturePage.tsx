"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiRefreshCcw, FiSearch } from "react-icons/fi";
import { doctorApi, errorMessage, uploadApi, type DoctorRecord } from "@/app/lib/api";
import { FileUploadField } from "@/app/components/FileUploadField";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

export function DoctorSignaturePage({ onBack }: { onBack?: () => void }) {
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);

  const notify = useCallback((kind: ToastKind, message: string) => {
    toastId.current += 1;
    setToasts((prev) => [...prev.slice(-3), { id: toastId.current, kind, message }]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await doctorApi.list({ limit: 100, status: "active" });
      setDoctors(result.data);
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

  const saveSignature = async (doctor: DoctorRecord, url: string | null) => {
    setSavingId(doctor.id);
    try {
      await doctorApi.update(doctor.id, { signature: url });
      setDoctors((prev) => prev.map((d) => (d.id === doctor.id ? { ...d, signature: url } : d)));
      notify("success", url ? "Signature uploaded." : "Signature removed.");
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const filtered = search.trim()
    ? doctors.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    : doctors;

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
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Doctor Signature</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">
          Upload or update a doctor's signature. The signature appears on printed prescriptions.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search doctor by name..."
              className="pl-9 w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)]"
            />
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
          <p className="text-xs text-[var(--muted)]">Loading doctors…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No doctors found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((doc) => (
              <div key={doc.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3">
                <div>
                  <p className="text-sm font-bold text-[var(--primary-dark)]">{doc.name}</p>
                  {doc.qualification && <p className="text-[10px] text-[var(--muted)]">{doc.qualification}</p>}
                  {doc.specialization && <p className="text-[10px] text-[var(--muted)]">{doc.specialization}</p>}
                </div>
                {doc.signature ? (
                  <div className="rounded-lg border border-[var(--border)] bg-white p-2 flex items-center justify-center h-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={doc.signature} alt="Signature" className="max-h-16 max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-white p-2 flex items-center justify-center h-20 text-[10px] text-[var(--muted)]">
                    No signature
                  </div>
                )}
                <FileUploadField
                  label={doc.signature ? "Replace signature" : "Upload signature"}
                  kind="signature"
                  value={doc.signature ?? ""}
                  onChange={(url) => saveSignature(doc, url || null)}
                  hint="PNG/JPG/WEBP up to 5MB."
                />
                {savingId === doc.id && (
                  <p className="text-[10px] text-[var(--muted)]">Saving…</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
