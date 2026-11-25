// app/prescriptions/FollowUpInstructionsPage.tsx
// Prescription Management → Follow-up Instructions. Clinical follow-up notes
// (date, window, instruction, referral) collected alongside the digital Rx.

"use client";

import { useCallback, useRef, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

interface FollowUpInstruction {
  id: number;
  patientName: string;
  date: string;
  after: string;
  unit: string;
  instruction: string;
  referTo: string;
}

export function FollowUpInstructionsPage({ onBack }: { onBack?: () => void }) {
  const [instructions, setInstructions] = useState<FollowUpInstruction[]>([]);
  const [patientName, setPatientName] = useState("");
  const [date, setDate] = useState("");
  const [after, setAfter] = useState("7");
  const [unit, setUnit] = useState("days");
  const [instruction, setInstruction] = useState("");
  const [referTo, setReferTo] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const seq = useRef(0);

  const notify = useCallback((kind: ToastKind, message: string) => {
    toastId.current += 1;
    setToasts((prev) => [...prev.slice(-3), { id: toastId.current, kind, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addInstruction = () => {
    if (!date) {
      notify("error", "Pick a follow-up date first.");
      return;
    }
    if (!instruction.trim()) {
      notify("error", "Write the follow-up instruction first.");
      return;
    }
    const id = ++seq.current;
    setInstructions((prev) => [
      ...prev,
      {
        id,
        patientName: patientName.trim(),
        date,
        after: after.trim() || "7",
        unit,
        instruction: instruction.trim(),
        referTo: referTo.trim(),
      },
    ]);
    setPatientName("");
    setDate("");
    setAfter("7");
    setInstruction("");
    setReferTo("");
    notify("success", "Follow-up instruction added.");
  };

  const removeInstruction = (id: number) => {
    setInstructions((prev) => prev.filter((r) => r.id !== id));
    notify("info", "Follow-up instruction removed.");
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
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Follow-up Instructions</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">
          Follow-up plans and instructions given with the digital prescription.
        </p>
      </div>

      <div className="card p-6 rounded-2xl border border-[var(--border)] shadow-sm space-y-4 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Patient name</label>
            <input
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Optional patient name"
              className="w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Follow-up date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">After (amount)</label>
            <input
              type="number"
              min={1}
              value={after}
              onChange={(e) => setAfter(e.target.value)}
              className="w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Unit</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            >
              <option value="days">Days</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Follow-up instruction</label>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Recheck BP after 1 month"
              className="w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Refer to</label>
            <input
              value={referTo}
              onChange={(e) => setReferTo(e.target.value)}
              placeholder="Optional referral"
              className="w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            />
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={addInstruction}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            <FiPlus className="w-3.5 h-3.5" />
            Add Follow-up Instruction
          </button>
        </div>

        {instructions.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-2">No follow-up instructions added yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--bg)] text-[var(--muted)]">
                  <th className="text-left py-2.5 px-3">Patient</th>
                  <th className="text-left py-2.5 px-3">Date</th>
                  <th className="text-left py-2.5 px-3">After</th>
                  <th className="text-left py-2.5 px-3">Instruction</th>
                  <th className="text-left py-2.5 px-3">Refer to</th>
                  <th className="text-left py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {instructions.map((f) => (
                  <tr key={f.id} className="border-t border-[var(--border)]">
                    <td className="py-2 px-3">{f.patientName || "—"}</td>
                    <td className="py-2 px-3">{f.date || "—"}</td>
                    <td className="py-2 px-3">
                      {f.after} {f.unit}
                    </td>
                    <td className="py-2 px-3">{f.instruction}</td>
                    <td className="py-2 px-3">{f.referTo || "—"}</td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => removeInstruction(f.id)}
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
