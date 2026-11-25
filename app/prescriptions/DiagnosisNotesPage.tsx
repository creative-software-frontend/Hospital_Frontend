// app/prescriptions/DiagnosisNotesPage.tsx
// Prescription Management → Diagnosis Notes. Free-text clinical diagnosis
// notes keyed to a diagnosis, built alongside the Rx / recommendations.

"use client";

import { useCallback, useRef, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const ILLNESSES = ["Fever", "Cold", "Cough", "Headache", "Body ache", "Stomach pain", "Diarrhea", "Vomiting", "Allergy", "Skin rash", "Joint pain", "Chest pain", "Breathing difficulty", "Weakness", "Dizziness", "Diabetes", "Hypertension", "Asthma", "Anemia", "Migraine"];

interface DiagnosisNote {
  id: number;
  diagnosis: string;
  notes: string;
}

const INPUT = "w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function DiagnosisNotesPage({ onBack }: { onBack?: () => void }) {
  const [notes, setNotes] = useState<DiagnosisNote[]>([]);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState("");
  const [noteText, setNoteText] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const noteSeq = useRef(0);

  const notify = useCallback((kind: ToastKind, message: string) => {
    toastId.current += 1;
    setToasts((prev) => [...prev.slice(-3), { id: toastId.current, kind, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addNote = () => {
    if (!selectedDiagnosis) {
      notify("error", "Select a diagnosis first.");
      return;
    }
    if (!noteText.trim()) {
      notify("error", "Write the diagnosis note first.");
      return;
    }
    const id = ++noteSeq.current;
    setNotes((prev) => [...prev, { id, diagnosis: selectedDiagnosis, notes: noteText.trim() }]);
    setNoteText("");
    setSelectedDiagnosis("");
    notify("success", `Diagnosis note added for ${selectedDiagnosis}.`);
  };

  const removeNote = (id: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    notify("info", "Diagnosis note removed.");
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
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Diagnosis Notes</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">
          Record clinical diagnosis notes. These sit next to the digital Rx, complaints and examination.
        </p>
      </div>

      <div className="card p-6 rounded-2xl border border-[var(--border)] shadow-sm space-y-4 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Diagnosis</label>
            <select
              value={selectedDiagnosis}
              onChange={(e) => setSelectedDiagnosis(e.target.value)}
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
          <div>
            <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Clinical notes</label>
            <textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Describe the diagnosis, severity, duration…"
              className={`${INPUT} resize-none max-w-md`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addNote}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            <FiPlus className="w-3.5 h-3.5" />
            Add Diagnosis Note
          </button>
        </div>

        {notes.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-2">No diagnosis notes added yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--bg)] text-[var(--muted)]">
                  <th className="text-left py-2.5 px-3">#</th>
                  <th className="text-left py-2.5 px-3">Diagnosis</th>
                  <th className="text-left py-2.5 px-3">Clinical notes</th>
                  <th className="text-left py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {notes.map((n, idx) => (
                  <tr key={n.id} className="border-t border-[var(--border)]">
                    <td className="py-2 px-3 text-[var(--muted)]">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <span className="font-bold text-[var(--primary-dark)]">{n.diagnosis}</span>
                    </td>
                    <td className="py-2 px-3">{n.notes}</td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => removeNote(n.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
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

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
