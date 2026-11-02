// app/doctors/CommissionSetupPage.tsx
// Sub-feature "Commission Setup": per-doctor commission configuration.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCcw, FiSave, FiSearch } from "react-icons/fi";
import {
  doctorApi,
  errorMessage,
  type DoctorRecord,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const COMMISSION_TYPES = [
  { value: "", label: "None" },
  { value: "PERCENT", label: "Percent (%)" },
  { value: "FIXED", label: "Fixed amount" },
];

interface Row {
  id: number;
  name: string;
  code: string;
  specialization: string | null;
  commissionType: "" | "PERCENT" | "FIXED";
  commissionValue: string;
  savedType: "" | "PERCENT" | "FIXED";
  savedValue: string;
  saving: boolean;
}

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-[11px] font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function CommissionSetupPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [reload, setReload] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    if (!searchTerm) {
      setRows([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await doctorApi.list({ page: 1, limit: 100 });
      let all = result.data;
      const totalPages = Math.min(result.pagination?.totalPages ?? 1, 10);
      for (let p = 2; p <= totalPages; p += 1) {
        const next = await doctorApi.list({ page: p, limit: 100 });
        all = all.concat(next.data);
      }
      const q = searchTerm.toLowerCase();
      const mapped: Row[] = all
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((d) => !q || [d.name, d.doctorCode, d.specialization ?? ""].some((v) => v.toLowerCase().includes(q)))
        .map((d: DoctorRecord) => {
          const ct = (d.commissionType as "" | "PERCENT" | "FIXED" | null) ?? "";
          const cv = d.commissionValue ?? "";
          return {
            id: d.id,
            name: d.name,
            code: d.doctorCode,
            specialization: d.specialization,
            commissionType: ct,
            commissionValue: cv,
            savedType: ct,
            savedValue: cv,
            saving: false,
          };
        });
      setRows(mapped);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load, reload]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const isDirty = (r: Row) =>
    r.commissionType !== r.savedType || r.commissionValue !== r.savedValue;

  const save = async (id: number) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, saving: true } : r)));
    try {
      await doctorApi.update(id, {
        commissionType: row.commissionType || null,
        commissionValue: row.commissionValue.trim() || null,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, saving: false, savedType: row.commissionType, savedValue: row.commissionValue }
            : r,
        ),
      );
      notify("success", `Commission saved for ${row.name}.`);
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, saving: false } : r)));
      notify("error", errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Doctor Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
          Commission Setup
        </h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Set each doctor&apos;s consultation commission. Percent applies to the consultation fee;
          fixed is a flat amount per visit.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Doctors</h4>
            <p className="text-xs text-[var(--muted)]">{rows.length} doctor(s) shown</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, ID, specialty…"
                className="pl-9 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 w-64 max-w-full"
              />
            </div>
            <button
              onClick={() => setReload((k) => k + 1)}
              className="p-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              title="Refresh"
            >
              <FiRefreshCcw className="w-4 h-4" />
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
              {searchInput ? "No doctors match your search." : "No doctors registered yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-[720px] w-full">
              <thead>
                <tr className="bg-[var(--bg)]">
                  {["Doctor", "Specialty", "Commission Type", "Commission Value", "Actions"].map((col) => (
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
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <p className="text-[12px] font-bold text-[var(--text)]">{r.name}</p>
                      <p className="text-[10px] font-bold text-[var(--primary-dark)]">{r.code}</p>
                    </td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                      {r.specialization ?? "—"}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <select
                        value={r.commissionType}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id
                                ? { ...x, commissionType: e.target.value as "" | "PERCENT" | "FIXED" }
                                : x,
                            ),
                          )
                        }
                        className={INPUT_CLS}
                      >
                        {COMMISSION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <input
                        type="text"
                        value={r.commissionValue}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id ? { ...x, commissionValue: e.target.value } : x,
                            ),
                          )
                        }
                        disabled={r.commissionType === ""}
                        placeholder={r.commissionType === "PERCENT" ? "%" : "Amount"}
                        className={INPUT_CLS}
                      />
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <button
                        onClick={() => save(r.id)}
                        disabled={r.saving || !isDirty(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                        style={{ background: "var(--primary)" }}
                      >
                        <FiSave className="w-3.5 h-3.5" />
                        {r.saving ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
