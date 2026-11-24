"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiSearch, FiTrash2, FiPlus } from "react-icons/fi";
import {
  errorMessage,
  medicineApi,
  type MedicineRecord,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const ILLNESSES = ["Fever", "Cold", "Cough", "Headache", "Body ache", "Stomach pain", "Diarrhea", "Vomiting", "Allergy", "Skin rash", "Joint pain", "Chest pain", "Breathing difficulty", "Weakness", "Dizziness", "Diabetes", "Hypertension", "Asthma", "Anemia", "Migraine"];

interface RecItem {
  id: number;
  medicine: MedicineRecord;
  dosage: string;
  frequency: string;
  duration: string;
  instruction: string;
}

const INPUT = "w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function MedicineRecommendationPage({ onBack }: { onBack?: () => void }) {
  const [selectedIllness, setSelectedIllness] = useState("");
  const [items, setItems] = useState<RecItem[]>([]);
  const [medSearch, setMedSearch] = useState("");
  const [medResults, setMedResults] = useState<MedicineRecord[]>([]);
  const [medSearching, setMedSearching] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((kind: ToastKind, message: string) => {
    toastId.current += 1;
    setToasts((prev) => [...prev.slice(-3), { id: toastId.current, kind, message }]);
  }, []);

  useEffect(() => {
    if (!medSearch.trim()) {
      setMedResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setMedSearching(true);
      try {
        const result = await medicineApi.list({ search: medSearch.trim(), limit: 15 });
        setMedResults(result.data);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Could not search medicines");
      } finally {
        setMedSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [medSearch, notify]);

  const addMedicine = (med: MedicineRecord) => {
    if (items.some((r) => r.medicine.id === med.id)) {
      notify("error", "Medicine already added.");
      return;
    }
    setItems((prev) => [
      ...prev,
      { id: Date.now(), medicine: med, dosage: "", frequency: "", duration: "", instruction: "" },
    ]);
    setMedSearch("");
    setMedResults([]);
  };

  const updateItem = (id: number, patch: Partial<RecItem>) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
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
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Medicine Recommendation</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">
          Build a recommended medicine list for a diagnosis. Search medicines from the database.
        </p>
      </div>

      <div className="card p-6 rounded-2xl border border-[var(--border)] shadow-sm space-y-4 max-w-4xl mx-auto">
        <div>
          <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Diagnosis / Illness</label>
          <select
            value={selectedIllness}
            onChange={(e) => setSelectedIllness(e.target.value)}
            className={`${INPUT} max-w-md`}
          >
            <option value="">— Select diagnosis —</option>
            {ILLNESSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {selectedIllness && (
          <p className="text-xs text-[var(--muted)]">
            Recommended medicines for: <span className="font-bold text-[var(--text)]">{selectedIllness}</span>
          </p>
        )}

        <div>
          <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Search & add medicines</label>
          <div className="relative mb-3">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
            <input
              value={medSearch}
              onChange={(e) => setMedSearch(e.target.value)}
              placeholder="Search medicine by name..."
              className="pl-9 w-full max-w-md h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            />
            {medSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--muted)]">Searching…</span>
            )}
            {medResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg">
                {medResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addMedicine(m)}
                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--primary-soft)]/20 cursor-pointer border-b border-[var(--border)] last:border-0"
                  >
                    <span className="font-bold text-[var(--primary-dark)]">{m.genericName}</span>
                    {m.brandName && <span className="text-[var(--muted)]"> ({m.brandName})</span>}
                    <span className="text-[10px] text-[var(--muted)] ml-2">{m.medicineCode}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-2">No medicines added. Search above to add.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--bg)] text-[var(--muted)]">
                    <th className="text-left py-2.5 px-3">#</th>
                    <th className="text-left py-2.5 px-3">Medicine</th>
                    <th className="text-left py-2.5 px-3">Dosage</th>
                    <th className="text-left py-2.5 px-3">Frequency</th>
                    <th className="text-left py-2.5 px-3">Duration</th>
                    <th className="text-left py-2.5 px-3">Instruction</th>
                    <th className="text-left py-2.5 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} className="border-t border-[var(--border)]">
                      <td className="py-2 px-3 text-[var(--muted)]">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-[var(--primary-dark)]">{item.medicine.genericName}</span>
                        {item.medicine.brandName && (
                          <span className="block text-[10px] text-[var(--muted)]">{item.medicine.brandName}</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <input value={item.dosage} onChange={(e) => updateItem(item.id, { dosage: e.target.value })} placeholder="500mg" className={INPUT} />
                      </td>
                      <td className="py-2 px-3">
                        <input value={item.frequency} onChange={(e) => updateItem(item.id, { frequency: e.target.value })} placeholder="1+0+1" className={INPUT} />
                      </td>
                      <td className="py-2 px-3">
                        <input value={item.duration} onChange={(e) => updateItem(item.id, { duration: e.target.value })} placeholder="7 days" className={INPUT} />
                      </td>
                      <td className="py-2 px-3">
                        <input value={item.instruction} onChange={(e) => updateItem(item.id, { instruction: e.target.value })} placeholder="after food" className={INPUT} />
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
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
        </div>
      </div>

      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
