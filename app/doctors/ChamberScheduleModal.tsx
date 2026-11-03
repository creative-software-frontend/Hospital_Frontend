"use client";

import { FiPlus, FiTrash2, FiX } from "react-icons/fi";
import { useState } from "react";
import type { ChamberRecord, ChamberScheduleRecord, DoctorRecord } from "@/app/lib/api";

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Props {
  chamber: ChamberRecord;
  rows: ChamberScheduleRecord[];
  doctors: DoctorRecord[];
  loading: boolean;
  saving: boolean;
  error: string;
  onRowsChange: (rows: ChamberScheduleRecord[]) => void;
  onSave: () => void;
  onClose: () => void;
}

export function ChamberScheduleModal({
  chamber,
  rows,
  doctors,
  loading,
  saving,
  error,
  onRowsChange,
  onSave,
  onClose,
}: Props) {
  const chamberDoctors = doctors.filter((doctor) => doctor.branchId === chamber.branchId);
  const [doctorSearch, setDoctorSearch] = useState<Record<number, string>>({});
  const update = (index: number, patch: Partial<ChamberScheduleRecord>) =>
    onRowsChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  const doctorLabel = (row: ChamberScheduleRecord) => {
    const search = doctorSearch[row.id] ?? "";
    if (doctorSearch[row.id] !== undefined) return search;
    const doctor = chamberDoctors.find((item) => item.id === row.doctorId);
    return doctor ? `${doctor.name} · ${doctor.doctorCode}` : "";
  };
  const doctorMatches = (query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return chamberDoctors.slice(0, 8);
    return chamberDoctors
      .filter((doctor) =>
        `${doctor.name} ${doctor.phone ?? ""} ${doctor.doctorCode} ${doctor.id}`
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 8);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6" onClick={() => !saving && onClose()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Weekly recurring schedule</span>
            <h3 className="font-black text-xl text-[var(--primary-dark)]">{chamber.name}</h3>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)]" aria-label="Close"><FiX /></button>
        </div>
        {error && <p className="alert-error text-xs mb-3">{error}</p>}
        {loading ? <div className="py-10 text-center text-xs text-[var(--muted)]">Loading schedule…</div> : (
          <>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="min-w-[760px] w-full">
                <thead><tr className="bg-[var(--bg)]">{["Doctor", "Day", "Start", "End", ""].map((label) => <th key={label} className="text-left text-[11px] font-bold text-[var(--muted)] px-3 py-2 border-b border-[var(--border)]">{label}</th>)}</tr></thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id} className="border-b border-[var(--border)]">
                      <td className="px-3 py-2">
                        <div className="relative">
                          <input
                            className={INPUT_CLS}
                            value={doctorLabel(row)}
                            placeholder="Search name, phone or ID"
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setDoctorSearch((current) => ({ ...current, [row.id]: value }));
                            }}
                            onFocus={(event) => {
                              const value = event.currentTarget.value;
                              setDoctorSearch((current) => ({ ...current, [row.id]: value }));
                            }}
                            disabled={saving}
                            aria-label="Search doctor by name, phone or ID"
                          />
                          {doctorSearch[row.id] !== undefined && (
                            <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-sm">
                              {doctorMatches(doctorSearch[row.id] ?? "").map((doctor) => (
                                <button
                                  key={doctor.id}
                                  type="button"
                                  className="w-full rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[var(--primary-soft)]/20"
                                  onClick={() => {
                                    update(index, { doctorId: doctor.id, doctor });
                                    setDoctorSearch((current) => ({ ...current, [row.id]: `${doctor.name} · ${doctor.doctorCode}` }));
                                  }}
                                >
                                  <span className="font-bold">{doctor.name}</span>
                                  <span className="block text-[10px] text-[var(--muted)]">
                                    ID {doctor.id} · {doctor.doctorCode}{doctor.phone ? ` · ${doctor.phone}` : ""}
                                  </span>
                                </button>
                              ))}
                              {doctorMatches(doctorSearch[row.id] ?? "").length === 0 && (
                                <p className="px-2.5 py-2 text-[11px] text-[var(--muted)]">No doctors found.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2"><select className={INPUT_CLS} value={row.dayOfWeek} onChange={(event) => update(index, { dayOfWeek: Number(event.target.value) })}>{DAYS.map((day, value) => <option key={day} value={value}>{day}</option>)}</select></td>
                      <td className="px-3 py-2"><input type="time" className={INPUT_CLS} value={row.startTime} onChange={(event) => update(index, { startTime: event.target.value })} /></td>
                      <td className="px-3 py-2"><input type="time" className={INPUT_CLS} value={row.endTime} onChange={(event) => update(index, { endTime: event.target.value })} /></td>
                      <td className="px-3 py-2"><button onClick={() => onRowsChange(rows.filter((_, rowIndex) => rowIndex !== index))} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg" title="Remove slot"><FiTrash2 /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 mt-4">
              <button
                onClick={() => chamberDoctors[0] && onRowsChange([...rows, { id: -Date.now(), chamberId: chamber.id, branchId: chamber.branchId, doctorId: chamberDoctors[0].id, dayOfWeek: 0, startTime: "09:00", endTime: "17:00", status: "active", doctor: { id: chamberDoctors[0].id, name: chamberDoctors[0].name, doctorCode: chamberDoctors[0].doctorCode } }])}
                disabled={chamberDoctors.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-[var(--bg)] disabled:opacity-50"
              ><FiPlus /> Add doctor slot</button>
              <button onClick={onSave} disabled={saving} className="px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>{saving ? "Saving…" : "Save schedule"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
