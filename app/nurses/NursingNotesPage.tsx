"use client";

import { useEffect, useRef, useState } from "react";
import { FiSearch, FiTrash2 } from "react-icons/fi";
import {
  errorMessage,
  nursingNoteApi,
  nurseApi,
  type CreateNursingNoteInput,
  type NursingNoteRecord,
  type NurseRecord,
  type PatientListRecord,
} from "@/app/lib/api";
import { PatientSearchPicker } from "@/app/patients/PatientSearchPicker";
import { ToastViewport, type ToastItem } from "@/app/patients/Toast";

const NOTE_TYPES = ["GENERAL", "ASSESSMENT", "VITALS", "MEDICATION", "WOUND", "HANDOVER"] as const;
const nowInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export function NursingNotesPage({ onBack }: { onBack: () => void }) {
  const [patient, setPatient] = useState<PatientListRecord | null>(null);
  const [notes, setNotes] = useState<NursingNoteRecord[]>([]);
  const [nurses, setNurses] = useState<NurseRecord[]>([]);
  const [nurseSearch, setNurseSearch] = useState("");
  const [selectedNurse, setSelectedNurse] = useState<NurseRecord | null>(null);
  const [form, setForm] = useState({ noteType: "GENERAL", note: "", observedAt: nowInput() });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    const term = nurseSearch.trim();
    if (!term) {
      const timer = setTimeout(() => setNurses([]), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      nurseApi.list({ search: term, limit: 8 }).then((result) => setNurses(result.data)).catch((err) => setError(errorMessage(err)));
    }, 300);
    return () => clearTimeout(timer);
  }, [nurseSearch]);

  useEffect(() => {
    if (!patient) {
      const timer = setTimeout(() => setNotes([]), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setLoading(true);
      nursingNoteApi
        .list({ patientId: patient.id, limit: 50 })
        .then((result) => setNotes(result.data))
        .catch((err) => setError(errorMessage(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [patient]);

  const addToast = (message: string, kind: ToastItem["kind"] = "success") => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current.slice(-3), { id, kind, message }]);
  };

  const save = async () => {
    if (!patient || !selectedNurse || !form.note.trim()) {
      setError("Select a patient, select a nurse, and enter a note.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input: CreateNursingNoteInput = {
        patientId: patient.id,
        nurseId: selectedNurse.id,
        noteType: form.noteType,
        note: form.note.trim(),
        observedAt: new Date(form.observedAt).toISOString(),
      };
      const created = await nursingNoteApi.create(input);
      setNotes((current) => [created, ...current]);
      setForm({ noteType: "GENERAL", note: "", observedAt: nowInput() });
      setNotice("Nursing note saved.");
      addToast("Nursing note saved.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this nursing note?")) return;
    try {
      await nursingNoteApi.remove(id);
      setNotes((current) => current.filter((note) => note.id !== id));
      addToast("Nursing note deleted.");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] cursor-pointer">
        ← Back to Nursing Management
      </button>
      <PatientSearchPicker
        title="Nursing Notes"
        description="Search for a patient before recording or reviewing bedside notes."
        selectedId={patient?.id}
        onPick={setPatient}
        eyebrow="Nursing Management"
        placeholder="Search patient by name, ID, or phone..."
      />

      {patient && (
        <>
          <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-lg text-[var(--primary-dark)]">{patient.name}</h3>
                <p className="text-xs text-[var(--muted)]">{patient.patientCode} · Record a nursing observation</p>
              </div>
              <button onClick={() => setPatient(null)} className="text-xs font-bold text-[var(--primary)] cursor-pointer">Choose another</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl">
              <label className="text-[11px] font-bold text-[var(--muted)]">
                Nurse *
                <div className="relative mt-1">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]" />
                  <input value={selectedNurse ? `${selectedNurse.name} (${selectedNurse.nurseCode})` : nurseSearch} onChange={(e) => { setSelectedNurse(null); setNurseSearch(e.target.value); }} placeholder="Search nurse by name or ID" className="w-full pl-9 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold" />
                  {!selectedNurse && nurses.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
                      {nurses.map((nurse) => (
                        <button key={nurse.id} type="button" onClick={() => { setSelectedNurse(nurse); setNurseSearch(""); setNurses([]); }} className="block w-full text-left px-3 py-2 text-xs hover:bg-[var(--primary-soft)]/20">
                          <span className="font-bold">{nurse.name}</span><span className="text-[var(--muted)]"> · {nurse.nurseCode} · {nurse.phone ?? "No phone"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">Note type
                <select value={form.noteType} onChange={(e) => setForm((current) => ({ ...current, noteType: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold">
                  {NOTE_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-bold text-[var(--muted)]">Observed at
                <input type="datetime-local" value={form.observedAt} onChange={(e) => setForm((current) => ({ ...current, observedAt: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold" />
              </label>
              <div className="flex items-end">
                <button onClick={save} disabled={saving} className="w-full px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>{saving ? "Saving…" : "Save note"}</button>
              </div>
            </div>
            <textarea value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} rows={3} maxLength={2000} placeholder="Describe the patient's condition, care provided, response, or handover..." className="w-full max-w-5xl px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold resize-y" />
            {error && <p className="text-sm alert-error">{error}</p>}
            {notice && <p className="text-xs font-bold text-emerald-600">{notice}</p>}
          </div>

          <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
            <h3 className="font-black text-lg text-[var(--primary-dark)]">Note history</h3>
            {loading ? <p className="text-xs text-[var(--muted)] mt-4">Loading notes…</p> : notes.length === 0 ? <p className="text-xs text-[var(--muted)] mt-4">No nursing notes for this patient yet.</p> : (
              <div className="mt-4 space-y-3">
                {notes.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[var(--border)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2"><span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-[var(--primary-soft)]/30 text-[var(--primary-dark)]">{item.noteType}</span><span className="text-[11px] font-bold">{item.nurse.name} · {item.nurse.nurseCode}</span></div>
                      <div className="flex items-center gap-2"><time className="text-[10px] text-[var(--muted)]">{new Date(item.observedAt).toLocaleString()}</time><button onClick={() => remove(item.id)} className="text-rose-500 cursor-pointer" title="Delete note"><FiTrash2 className="w-3.5 h-3.5" /></button></div>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text)] whitespace-pre-wrap">{item.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  );
}
