// app/prescriptions/PrescriptionOptionsPage.tsx
// Branch-scoped option lists that power the Digital Prescription pickers.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiPlus, FiRefreshCcw, FiTrash2 } from "react-icons/fi";
import {
  settingsApi,
  errorMessage,
  type PrescriptionOptionCategory,
  type PrescriptionOptionsByCategory,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const CATEGORIES: {
  category: PrescriptionOptionCategory;
  title: string;
  hint: string;
  placeholder: string;
}[] = [
  { category: "ILLNESS", title: "Illnesses / Complaints", hint: "Shown in Add Complaint", placeholder: "e.g. Dengue" },
  { category: "DURATION", title: "Durations", hint: "Shown after choosing a complaint", placeholder: "e.g. 4 days" },
  { category: "BP", title: "Blood Pressure", hint: "On Examination values", placeholder: "e.g. 120/80" },
  { category: "TEMPERATURE", title: "Temperature", hint: "On Examination values", placeholder: "e.g. 99°F" },
  { category: "PULSE", title: "Pulse", hint: "On Examination values", placeholder: "e.g. 72" },
  { category: "RESPIRATION", title: "Respiration", hint: "On Examination values", placeholder: "e.g. 16" },
  { category: "SPO2", title: "SpO2", hint: "On Examination values", placeholder: "e.g. 98%" },
  { category: "WEIGHT", title: "Weight", hint: "On Examination values", placeholder: "e.g. 60 kg" },
  { category: "FREQUENCY", title: "Medicine Frequency", hint: "Shown on each prescribed medicine", placeholder: "e.g. 1+1+1" },
  { category: "INSTRUCTION", title: "Medicine Instructions", hint: "Shown on each prescribed medicine", placeholder: "e.g. After food" },
  { category: "ADVICE", title: "Advices", hint: "Shown in the Advices section", placeholder: "e.g. Take rest" },
];

const emptyDrafts = (): Record<PrescriptionOptionCategory, string> =>
  Object.fromEntries(CATEGORIES.map((c) => [c.category, ""])) as Record<
    PrescriptionOptionCategory,
    string
  >;

export function PrescriptionOptionsPage({ onBack }: { onBack?: () => void }) {
  const [options, setOptions] = useState<PrescriptionOptionsByCategory | null>(null);
  const [drafts, setDrafts] = useState<Record<PrescriptionOptionCategory, string>>(emptyDrafts);
  const [busyCategory, setBusyCategory] = useState<PrescriptionOptionCategory | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<PrescriptionOptionCategory>("ILLNESS");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = toastId.current++;
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await settingsApi.prescriptionOptions.list();
        setOptions(result.options);
        setError("");
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [reloadKey]);

  const addOption = async (category: PrescriptionOptionCategory) => {
    const label = drafts[category].trim();
    if (!label || busyCategory) return;
    setBusyCategory(category);
    setError("");
    try {
      const result = await settingsApi.prescriptionOptions.create({ category, label });
      setOptions((prev) =>
        prev ? { ...prev, [category]: [...prev[category], result.option] } : prev,
      );
      setDrafts((prev) => ({ ...prev, [category]: "" }));
      notify("success", `"${label}" added.`);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      notify("error", message);
    } finally {
      setBusyCategory(null);
    }
  };

  const removeOption = async (category: PrescriptionOptionCategory, id: number, label: string) => {
    if (!window.confirm(`Remove "${label}" from this list?`)) return;
    setRemovingId(id);
    setError("");
    try {
      await settingsApi.prescriptionOptions.remove(id);
      setOptions((prev) =>
        prev ? { ...prev, [category]: prev[category].filter((o) => o.id !== id) } : prev,
      );
      notify("success", `"${label}" removed.`);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      notify("error", message);
    } finally {
      setRemovingId(null);
    }
  };

  const selected = CATEGORIES.find((c) => c.category === selectedCategory) ?? CATEGORIES[0];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] cursor-pointer print:hidden"
      >
        ← Back to Prescription Management
      </button>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Prescription Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Prescription Options</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Add or remove the choices shown in Digital Prescription pickers. These lists are stored
          per branch — changes appear immediately when a prescription is opened.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Option Lists</h4>
            <p className="text-xs text-[var(--muted)]">
              {loading ? "Loading…" : "Applies to this branch only"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="p-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            title="Refresh"
          >
            <FiRefreshCcw className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-sm alert-error">{error}</p>}

        {loading || !options ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2">
              {CATEGORIES.map(({ category, title }) => {
                const active = selected.category === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    aria-pressed={active}
                    className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold border transition-colors ${
                      active
                        ? "bg-[var(--primary-soft)]/50 border-[var(--primary)]/40 text-[var(--primary-dark)]"
                        : "border-transparent text-[var(--muted)] hover:bg-white hover:text-[var(--text)]"
                    }`}
                  >
                    <span>{title}</span>
                    <span className="text-[10px] font-bold text-[var(--muted)]">
                      {options[category].length}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 sm:p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h5 className="text-xs font-extrabold text-[var(--text)]">{selected.title}</h5>
                <span className="text-[10px] font-bold text-[var(--muted)]">
                  {options[selected.category].length} option
                  {options[selected.category].length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-[10px] text-[var(--muted)] mt-0.5">{selected.hint}</p>

              <div className="mt-3 rounded-lg border border-[var(--border)] bg-white divide-y divide-[var(--border)]">
                {options[selected.category].length === 0 ? (
                  <p className="px-3 py-4 text-[11px] text-[var(--muted)] italic">
                    No options yet.
                  </p>
                ) : (
                  options[selected.category].map((option) => (
                    <div
                      key={option.id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="text-xs font-semibold text-[var(--text)]">
                        {option.label}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          removeOption(selected.category, option.id, option.label)
                        }
                        disabled={removingId === option.id}
                        className="shrink-0 text-[var(--muted)] hover:text-rose-500 cursor-pointer disabled:opacity-50"
                        title={`Remove ${option.label}`}
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)] max-w-3xl">
                <input
                  type="text"
                  value={drafts[selected.category]}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [selected.category]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addOption(selected.category);
                    }
                  }}
                  placeholder={selected.placeholder}
                  className="min-w-0 flex-1 h-9 rounded-lg border border-[var(--border)] bg-white px-3 text-xs outline-none focus:border-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={() => addOption(selected.category)}
                  disabled={
                    !drafts[selected.category].trim() ||
                    busyCategory !== null ||
                    removingId !== null
                  }
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ background: "var(--primary)" }}
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  {busyCategory === selected.category ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
