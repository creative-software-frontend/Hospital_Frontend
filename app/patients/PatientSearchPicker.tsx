// app/patients/PatientSearchPicker.tsx
// Shared "search a patient first" card used by the Patient Management
// sub-feature pages (profile, history, treatment records). Debounced server
// side search; selection is owned by the parent page.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiChevronRight, FiRefreshCcw, FiSearch, FiUser } from "react-icons/fi";
import { patientApi, calcAge, errorMessage, type PatientListRecord } from "@/app/lib/api";
import { genderLabel } from "@/app/patients/constants";

export function PatientSearchPicker({
  title,
  description,
  selectedId,
  onPick,
  eyebrow = "Patient Management",
  placeholder = "Search patient by name, code, phone, email...",
  refreshToken = 0,
}: {
  title: string;
  description: string;
  /** Highlights the row of the patient currently open on the page. */
  selectedId?: number | null;
  onPick: (patient: PatientListRecord) => void;
  eyebrow?: string;
  placeholder?: string;
  /** Bump to re-run the search (e.g. after a save or delete). */
  refreshToken?: number;
}) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PatientListRecord[]>([]);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState("");
  const [nonce, setNonce] = useState(0);

  // Debounce the free-text search.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // The fetch is deferred a tick so the effect body never sets state
  // synchronously (react-hooks/set-state-in-effect).
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      patientApi
        .list({ search: term || undefined, limit: 10 })
        .then((r) => {
          if (!active) return;
          setResults(r.data);
          setSearchError("");
        })
        .catch((err) => {
          if (active) setSearchError(errorMessage(err));
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, nonce, refreshToken]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return (
    <div className="card p-6 rounded-2xl shadow-sm space-y-4 w-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
            {eyebrow}
          </span>
          <h3 className="font-black text-xl text-[var(--primary-dark)]">{title}</h3>
          <p className="text-xs text-[var(--muted)] mt-1">{description}</p>
        </div>
        <button
          onClick={retry}
          title="Refresh results"
          className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer shrink-0"
        >
          <FiRefreshCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-full max-w-md relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
        />
      </div>

      {searchError && (
        <div className="alert-error text-xs flex items-center justify-between">
          {searchError}
          <button onClick={retry} className="text-xs font-bold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
        {searching ? (
          <div className="px-4 py-6 text-center">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--primary)]" />
          </div>
        ) : results.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs font-bold text-[var(--muted)]">
            <FiUser className="w-5 h-5 mx-auto mb-2 opacity-50" />
            No patients match “{search || "your search"}”.
          </div>
        ) : (
          results.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors cursor-pointer hover:bg-[var(--primary-soft)]/15 ${
                selectedId === p.id ? "bg-[var(--primary-soft)]/20" : ""
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] flex items-center justify-center shrink-0">
                  <FiUser className="w-3.5 h-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-[var(--text)] truncate">{p.name}</span>
                  <span className="block text-[10px] text-[var(--muted)] truncate">
                    {[p.patientCode, genderLabel(p.gender), calcAge(p.dateOfBirth), p.phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {p.status === "inactive" && (
                  <span className="text-[10px] font-bold text-rose-500 border border-rose-200 bg-rose-50 rounded-full px-2 py-0.5">
                    Inactive
                  </span>
                )}
                <FiChevronRight className="w-3.5 h-3.5 text-[var(--muted)]" />
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
