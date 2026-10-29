// app/doctors/DoctorSchedulePage.tsx
// Sub-feature "Doctor Schedule Management": weekly availability per doctor.
// Each day can be toggled available with a start/end time; saving replaces the
// whole week through PUT /api/doctor-schedules/doctor/:doctorId.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";
import {
  doctorApi,
  doctorScheduleApi,
  errorMessage,
  type ActiveStatus,
  type DoctorRecord,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DaySlot {
  available: boolean;
  startTime: string;
  endTime: string;
}

const DEFAULT_SLOT: DaySlot = { available: true, startTime: "09:00", endTime: "17:00" };
const OFF_SLOT: DaySlot = { available: false, startTime: "09:00", endTime: "17:00" };

function buildInitial(): DaySlot[] {
  return DAY_LABELS.map((_, i) => (i === 0 || i === 6 ? { ...OFF_SLOT } : { ...DEFAULT_SLOT }));
}

export function DoctorSchedulePage() {
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [slots, setSlots] = useState<DaySlot[]>(buildInitial());
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    try {
      const result = await doctorApi.list({ page: 1, limit: 100 });
      const sorted = [...result.data].sort((a, b) => a.name.localeCompare(b.name));
      setDoctors(sorted);
      if (sorted.length > 0 && doctorId === null) setDoctorId(sorted[0].id);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingDoctors(false);
    }
  }, [doctorId]);

  useEffect(() => {
    const timer = setTimeout(() => loadDoctors(), 0);
    return () => clearTimeout(timer);
  }, [loadDoctors]);

  const loadSchedule = useCallback(async (id: number) => {
    setLoadingSchedule(true);
    try {
      const rows = await doctorScheduleApi.forDoctor(id);
      const next = buildInitial();
      for (const row of rows) {
        const idx = row.dayOfWeek;
        if (idx < 0 || idx > 6) continue;
        next[idx] = {
          available: row.status === "active",
          startTime: row.startTime ?? "09:00",
          endTime: row.endTime ?? "17:00",
        };
      }
      setSlots(next);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    if (doctorId != null) {
      const timer = setTimeout(() => loadSchedule(doctorId), 0);
      return () => clearTimeout(timer);
    }
  }, [doctorId, loadSchedule]);

  const updateDay = (index: number, patch: Partial<DaySlot>) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const save = async () => {
    if (doctorId == null) return;
    setSaving(true);
    try {
      const slotsPayload = slots.map((s, i) => ({
        dayOfWeek: i,
        startTime: s.available ? s.startTime : null,
        endTime: s.available ? s.endTime : null,
        status: (s.available ? "active" : "inactive") as ActiveStatus,
      }));
      await doctorScheduleApi.replace(doctorId, { slots: slotsPayload });
      const doc = doctors.find((d) => d.id === doctorId);
      notify("success", `Schedule saved for ${doc?.name ?? "the doctor"}.`);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  return (
    <div className="space-y-4">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Doctor Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
          Doctor Schedule Management
        </h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Set each doctor&apos;s working days and hours. These slots feed appointment booking.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        {error && (
          <div className="alert-error text-xs flex items-center justify-between">
            {error}
            <button
              onClick={() => {
                loadDoctors();
                if (doctorId != null) loadSchedule(doctorId);
              }}
              className="text-xs font-bold underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,24rem)] gap-3 items-end">
          <div>
            <label htmlFor="ds-doctor" className="block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1">
              Doctor
            </label>
            <select
              id="ds-doctor"
              value={doctorId ?? ""}
              onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : null)}
              disabled={loadingDoctors}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            >
              {loadingDoctors ? (
                <option>Loading doctors…</option>
              ) : doctors.length === 0 ? (
                <option>No doctors registered</option>
              ) : (
                doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.doctorCode})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {doctorId != null && (
          <>
            {loadingSchedule ? (
              <div className="py-10 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
                <p className="text-xs font-bold text-[var(--muted)] mt-3">Loading schedule…</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="min-w-[640px] w-full">
                    <thead>
                      <tr className="bg-[var(--bg)]">
                        <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                          Day
                        </th>
                        <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                          Available
                        </th>
                        <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                          Start
                        </th>
                        <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                          End
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {slots.map((slot, i) => (
                        <tr key={i} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                          <td className="text-[12px] font-bold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                            {DAY_LABELS[i]}
                          </td>
                          <td className="px-4 py-3 border-b border-[var(--border)]">
                            <input
                              type="checkbox"
                              checked={slot.available}
                              onChange={(e) => updateDay(i, { available: e.target.checked })}
                              className="w-4 h-4 accent-[var(--primary)] cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 border-b border-[var(--border)]">
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => updateDay(i, { startTime: e.target.value })}
                              disabled={!slot.available}
                              className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-[var(--primary)]/15 disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3 border-b border-[var(--border)]">
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => updateDay(i, { endTime: e.target.value })}
                              disabled={!slot.available}
                              className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-[var(--primary)]/15 disabled:opacity-50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                  <p className="text-[11px] text-[var(--muted)] font-semibold">
                    {selectedDoctor ? `Editing schedule for ${selectedDoctor.name}` : ""}
                  </p>
                  <button
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                    style={{ background: "var(--primary)" }}
                  >
                    <FiSave className="w-3.5 h-3.5" />
                    {saving ? "Saving…" : "Save schedule"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
