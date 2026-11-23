"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiPrinter, FiTrash2, FiSearch, FiUser, FiX } from "react-icons/fi";
import {
  doctorApi,
  errorMessage,
  medicineApi,
  patientApi,
  type DoctorRecord,
  type MedicineRecord,
  type PatientListRecord,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

interface RxItem {
  id: number;
  medicine: MedicineRecord;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instruction: string;
}

const INPUT = "w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

const ILLNESSES = ["Fever", "Cold", "Cough", "Headache", "Body ache", "Stomach pain", "Diarrhea", "Vomiting", "Allergy", "Skin rash", "Joint pain", "Chest pain", "Breathing difficulty", "Weakness", "Dizziness", "Diabetes", "Hypertension", "Asthma", "Anemia", "Migraine"];

const BP_OPTIONS = ["90/60", "100/60", "100/70", "110/70", "120/80", "130/80", "130/90", "140/90", "150/90", "160/100"];
const TEMP_OPTIONS = ["97°F", "98°F", "98.6°F", "99°F", "100°F", "101°F", "102°F", "103°F", "104°F"];
const PULSE_OPTIONS = ["60", "65", "70", "72", "75", "80", "85", "90", "95", "100", "110", "120"];
const RESP_OPTIONS = ["12", "14", "16", "18", "20", "22", "24"];
const SPO2_OPTIONS = ["90%", "92%", "94%", "95%", "96%", "97%", "98%", "99%", "100%"];
const WEIGHT_OPTIONS = ["40 kg", "45 kg", "50 kg", "55 kg", "60 kg", "65 kg", "70 kg", "75 kg", "80 kg", "85 kg", "90 kg", "95 kg", "100 kg"];
const FOLLOWUP_OPTIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "As needed", "PRN"];

export function DigitalPrescriptionPage({ onBack }: { onBack?: () => void }) {
  const [selectedPatient, setSelectedPatient] = useState<PatientListRecord | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorRecord | null>(null);
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [complaints, setComplaints] = useState<string[]>([]);
  const [complaintSearch, setComplaintSearch] = useState("");
  const [showComplaintDrop, setShowComplaintDrop] = useState(false);
  const [bp, setBp] = useState("");
  const [temp, setTemp] = useState("");
  const [pulse, setPulse] = useState("");
  const [resp, setResp] = useState("");
  const [spo2, setSpo2] = useState("");
  const [weight, setWeight] = useState("");
  const [rxItems, setRxItems] = useState<RxItem[]>([]);
  const [advice, setAdvice] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [medSearch, setMedSearch] = useState("");
  const [medResults, setMedResults] = useState<MedicineRecord[]>([]);
  const [medSearching, setMedSearching] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  // Patient search
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientListRecord[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [showPatientDrop, setShowPatientDrop] = useState(false);

  // Doctor search
  const [doctorSearch, setDoctorSearch] = useState("");
  const [showDoctorDrop, setShowDoctorDrop] = useState(false);

  const notify = useCallback((kind: ToastKind, message: string) => {
    toastId.current += 1;
    setToasts((prev) => [...prev.slice(-3), { id: toastId.current, kind, message }]);
  }, []);

  useEffect(() => {
    doctorApi
      .list({ limit: 100, status: "active" })
      .then((r) => setDoctors(r.data))
      .catch(() => {});
  }, []);

  // Patient search debounce
  useEffect(() => {
    if (!patientSearch.trim()) {
      setPatientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setPatientSearching(true);
      try {
        const result = await patientApi.list({ search: patientSearch.trim(), limit: 8 });
        setPatientResults(result.data);
        setShowPatientDrop(true);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Could not search patients");
      } finally {
        setPatientSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch, notify]);

  // Medicine search debounce
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

  const filteredDoctors = doctorSearch.trim()
    ? doctors.filter((d) => d.name.toLowerCase().includes(doctorSearch.toLowerCase()))
    : doctors;

  const filteredComplaints = complaintSearch.trim()
    ? ILLNESSES.filter((c) => c.toLowerCase().includes(complaintSearch.toLowerCase()) && !complaints.includes(c))
    : ILLNESSES.filter((c) => !complaints.includes(c));

  const addComplaint = (c: string) => {
    if (!c || complaints.includes(c)) return;
    setComplaints((prev) => [...prev, c]);
    setComplaintSearch("");
  };

  const removeComplaint = (c: string) => {
    setComplaints((prev) => prev.filter((x) => x !== c));
  };

  const addMedicine = (med: MedicineRecord) => {
    if (rxItems.some((r) => r.medicine.id === med.id)) {
      notify("error", "Medicine already added.");
      return;
    }
    setRxItems((prev) => [
      ...prev,
      { id: Date.now(), medicine: med, dosage: "", frequency: "", duration: "", quantity: "", instruction: "" },
    ]);
    setMedSearch("");
    setMedResults([]);
  };

  const updateRx = (id: number, patch: Partial<RxItem>) => {
    setRxItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRx = (id: number) => {
    setRxItems((prev) => prev.filter((r) => r.id !== id));
  };

  const calcAge = (dob: string): string => {
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    const months = (now.getMonth() - birth.getMonth() + 12) % 12;
    return `${age} Years ${months} Months`;
  };

  const print = () => {
    const prevTitle = document.title;
    document.title = "";
    window.print();
    document.title = prevTitle;
  };

  const reset = () => {
    setSelectedPatient(null);
    setPatientSearch("");
    setPatientResults([]);
    setComplaints([]);
    setComplaintSearch("");
    setBp("");
    setTemp("");
    setPulse("");
    setResp("");
    setSpo2("");
    setWeight("");
    setRxItems([]);
    setAdvice("");
    setFollowUp("");
    setMedSearch("");
    setMedResults([]);
  };

  const handlePickPatient = (p: PatientListRecord) => {
    setSelectedPatient(p);
    setPatientSearch("");
    setPatientResults([]);
    setShowPatientDrop(false);
  };

  return (
    <div className="space-y-6">
      {onBack && (
        <button
          onClick={onBack}
          className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] cursor-pointer print:hidden"
        >
          ← Back to Prescription Management
        </button>
      )}
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm print:hidden">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Prescription Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Digital Prescription</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5">
          Create a digital prescription with complaint, examination, and Rx. Printable.
        </p>
      </div>

      {/* On-screen form */}
      <div className="card p-6 rounded-2xl border border-[var(--border)] shadow-sm space-y-6 print:hidden max-w-5xl mx-auto">
        {/* Doctor & Patient */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Doctor selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--muted)]">Doctor</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                type="text"
                value={selectedDoctor ? selectedDoctor.name : doctorSearch}
                onChange={(e) => {
                  setDoctorSearch(e.target.value);
                  if (selectedDoctor) setSelectedDoctor(null);
                  setShowDoctorDrop(true);
                }}
                onFocus={() => setShowDoctorDrop(true)}
                placeholder="Search doctor by name..."
                className="pl-9 w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
              />
              {showDoctorDrop && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg">
                  {(doctorSearch.trim()
                    ? filteredDoctors
                    : doctors
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setSelectedDoctor(d);
                        setDoctorSearch("");
                        setShowDoctorDrop(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--primary-soft)]/20 cursor-pointer border-b border-[var(--border)] last:border-0"
                    >
                      <span className="font-bold text-[var(--primary-dark)]">{d.name}</span>
                      {d.qualification && <span className="text-[var(--muted)]"> ({d.qualification})</span>}
                      {d.specialization && <span className="text-[10px] text-[var(--muted)] ml-2">{d.specialization}</span>}
                    </button>
                  ))}
                  {filteredDoctors.length === 0 && doctorSearch.trim() && (
                    <div className="px-3 py-2 text-xs text-[var(--muted)]">No doctors match.</div>
                  )}
                </div>
              )}
            </div>
            {selectedDoctor && (
              <p className="text-xs text-[var(--muted)]">
                Selected: <span className="font-bold text-[var(--text)]">{selectedDoctor.name}</span>
                {selectedDoctor.qualification ? ` (${selectedDoctor.qualification})` : ""}
              </p>
            )}
          </div>

          {/* Patient selector */}
          <div className="space-y-2 relative">
            <label className="text-xs font-bold text-[var(--muted)]">Patient</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                onFocus={() => setShowPatientDrop(true)}
                placeholder="Search patient by name, code, phone..."
                className="pl-9 w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
              />
              {patientSearching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--muted)]">Searching…</span>
              )}
            </div>
            {showPatientDrop && patientResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg">
                {patientResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePickPatient(p)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--primary-soft)]/20 cursor-pointer border-b border-[var(--border)] last:border-0"
                  >
                    <span className="font-bold text-[var(--primary-dark)]">{p.name}</span>
                    <span className="text-[10px] text-[var(--muted)] ml-2">{p.patientCode}</span>
                    {p.gender && <span className="text-[10px] text-[var(--muted)] ml-2">{p.gender}</span>}
                  </button>
                ))}
              </div>
            )}
            {selectedPatient && (
              <p className="text-xs text-[var(--muted)]">
                Selected: <span className="font-bold text-[var(--text)]">{selectedPatient.name}</span> ({selectedPatient.patientCode})
                {selectedPatient.gender ? ` · ${selectedPatient.gender}` : ""}
                {selectedPatient.dateOfBirth ? ` · Age ${calcAge(selectedPatient.dateOfBirth)}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Complaint */}
        <div>
          <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Complaint / Diagnosis</label>
          <div className="flex items-center gap-2 mb-2">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) addComplaint(e.target.value);
                e.target.value = "";
              }}
              className={`${INPUT} max-w-xs`}
            >
              <option value="">— Select illness to add —</option>
              {ILLNESSES.filter((c) => !complaints.includes(c)).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {complaints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {complaints.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[var(--primary)]/30 bg-[var(--primary-soft)]/30 text-xs font-semibold text-[var(--text)]"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeComplaint(c)}
                    className="text-[var(--muted)] hover:text-rose-500 cursor-pointer ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Examination */}
        <div>
          <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">On Examination</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <select value={bp} onChange={(e) => setBp(e.target.value)} className={INPUT}>
              <option value="">BP</option>
              {BP_OPTIONS.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
            <select value={temp} onChange={(e) => setTemp(e.target.value)} className={INPUT}>
              <option value="">Temp</option>
              {TEMP_OPTIONS.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
            <select value={pulse} onChange={(e) => setPulse(e.target.value)} className={INPUT}>
              <option value="">Pulse</option>
              {PULSE_OPTIONS.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
            <select value={resp} onChange={(e) => setResp(e.target.value)} className={INPUT}>
              <option value="">Resp</option>
              {RESP_OPTIONS.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
            <select value={spo2} onChange={(e) => setSpo2(e.target.value)} className={INPUT}>
              <option value="">SpO2</option>
              {SPO2_OPTIONS.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
            <select value={weight} onChange={(e) => setWeight(e.target.value)} className={INPUT}>
              <option value="">Weight</option>
              {WEIGHT_OPTIONS.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
          </div>
        </div>

        {/* Rx */}
        <div>
          <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Rx (Medicines)</label>
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
              <div className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg">
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

          {rxItems.length === 0 ? (
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
                    <th className="text-left py-2.5 px-3">Qty</th>
                    <th className="text-left py-2.5 px-3">Instruction</th>
                    <th className="text-left py-2.5 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rxItems.map((item, idx) => (
                    <tr key={item.id} className="border-t border-[var(--border)]">
                      <td className="py-2 px-3 text-[var(--muted)]">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-[var(--primary-dark)]">{item.medicine.genericName}</span>
                        {item.medicine.brandName && (
                          <span className="block text-[10px] text-[var(--muted)]">{item.medicine.brandName}</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <input value={item.dosage} onChange={(e) => updateRx(item.id, { dosage: e.target.value })} placeholder="500mg" className={INPUT} />
                      </td>
                      <td className="py-2 px-3">
                        <input value={item.frequency} onChange={(e) => updateRx(item.id, { frequency: e.target.value })} placeholder="1+0+1" className={INPUT} />
                      </td>
                      <td className="py-2 px-3">
                        <input value={item.duration} onChange={(e) => updateRx(item.id, { duration: e.target.value })} placeholder="7 days" className={INPUT} />
                      </td>
                      <td className="py-2 px-3">
                        <input value={item.quantity} onChange={(e) => updateRx(item.id, { quantity: e.target.value })} placeholder="Qty" className={INPUT} />
                      </td>
                      <td className="py-2 px-3">
                        <input value={item.instruction} onChange={(e) => updateRx(item.id, { instruction: e.target.value })} placeholder="after food" className={INPUT} />
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => removeRx(item.id)}
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

        {/* Advice */}
        <div>
          <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Advices</label>
          <textarea
            value={advice}
            onChange={(e) => setAdvice(e.target.value)}
            placeholder="Additional advice, follow-up instructions..."
            className={`${INPUT} min-h-[60px] max-w-lg`}
            rows={2}
          />
        </div>

        <div>
          <label className="text-xs font-bold text-[var(--muted)] block mb-1.5">Follow up</label>
          <select
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className={`${INPUT} max-w-xs`}
          >
            <option value="">— Select —</option>
            {FOLLOWUP_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2 print:hidden">
          <button
            onClick={print}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            <FiPrinter className="w-3.5 h-3.5" />
            Print Prescription
          </button>
          <button
            onClick={reset}
            className="h-10 rounded-xl px-4 text-xs font-bold border border-[var(--border)] text-[var(--muted)] cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Printable prescription (print only) — professional medical layout */}
      <div className="hidden print:block p-4">
        <div className="flex justify-between items-start border-b border-black pb-2 mb-2">
          <div className="w-1/2 pr-2">
            <h1 className="text-lg font-black leading-tight">{selectedDoctor ? selectedDoctor.name : "Doctor Name"}</h1>
            <p className="text-sm leading-tight">{selectedDoctor?.qualification ?? "Qualification"}</p>
            {selectedDoctor?.specialization && <p className="text-xs leading-tight">{selectedDoctor.specialization}</p>}
            {selectedDoctor?.bmdcRegistrationNo && <p className="text-xs leading-tight">BMDC Reg: {selectedDoctor.bmdcRegistrationNo}</p>}
          </div>
          <div className="w-1/2 pl-2 text-right text-xs leading-tight">
            {selectedDoctor?.phone && <p>{selectedDoctor.phone}</p>}
            {selectedDoctor?.email && <p>{selectedDoctor.email}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs border-b border-black pb-2 mb-2">
          <span><span className="font-bold">Name:</span> {selectedPatient?.name ?? "—"}</span>
          <span><span className="font-bold">Age:</span> {selectedPatient?.dateOfBirth ? calcAge(selectedPatient.dateOfBirth) : "—"}</span>
          <span><span className="font-bold">Gender:</span> {selectedPatient?.gender ?? "—"}</span>
          <span><span className="font-bold">Date:</span> {new Date().toLocaleDateString()}</span>
          <span><span className="font-bold">ID:</span> {selectedPatient?.patientCode ?? "—"}</span>
        </div>

        <div className="flex gap-2" style={{ minHeight: "200px" }}>
          <div className="w-[28%] pr-2 border-r border-black">
            {complaints.length > 0 && (
              <div className="mb-3">
                <p className="font-bold text-xs mb-0.5">Complaints:</p>
                <ul className="text-xs space-y-0.5">
                  {complaints.map((c) => (
                    <li key={c} className="ml-2">• {c}</li>
                  ))}
                </ul>
              </div>
            )}

            {(bp || temp || pulse || resp || spo2 || weight) && (
              <div>
                <p className="font-bold text-xs mb-0.5">On Examination:</p>
                <div className="text-xs space-y-0.5 ml-2">
                  {temp && <p>Temperature {temp}</p>}
                  {bp && <p>Blood Pressure {bp} mmHg</p>}
                  {pulse && <p>Pulse {pulse}</p>}
                  {resp && <p>Respiration {resp}</p>}
                  {spo2 && <p>SpO2 {spo2}</p>}
                  {weight && <p>Weight {weight}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="w-[72%] pl-2">
            <p className="font-bold text-lg mb-1">Rx</p>
            {rxItems.length > 0 && (
              <ol className="text-sm space-y-2">
                {rxItems.map((item, idx) => (
                  <li key={item.id}>
                    <span className="font-bold">{idx + 1}. {item.medicine.genericName}</span>
                    {item.medicine.brandName && <span className="text-xs"> ({item.medicine.brandName})</span>}
                    {item.dosage && <span className="block ml-4 text-xs">{item.dosage}</span>}
                    {item.frequency && <span className="block ml-4 text-xs">{item.frequency}</span>}
                    {item.instruction && <span className="block ml-4 text-xs">{item.instruction}</span>}
                    {item.duration && <span className="block ml-4 text-xs">{item.duration}</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {advice && (
          <div className="mt-3 border-t border-black pt-2">
            <p className="font-bold text-sm">Advices:</p>
            <p className="text-sm ml-2">{advice}</p>
          </div>
        )}

        {followUp && (
          <p className="text-sm mt-2">
            <span className="font-bold">Follow up:</span> {followUp}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <div className="text-center">
            <div className="w-40 border-b border-black mb-1" />
            <p className="text-xs">Doctor's Signature</p>
          </div>
        </div>
      </div>

      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}