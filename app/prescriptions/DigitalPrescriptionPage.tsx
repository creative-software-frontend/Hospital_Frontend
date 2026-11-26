"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiPrinter, FiTrash2, FiSearch, FiPlus } from "react-icons/fi";
import {
  doctorApi,
  medicineApi,
  patientApi,
  prescriptionApi,
  settingsApi,
  errorMessage,
  type DoctorRecord,
  type MedicineRecord,
  type PatientListRecord,
  type PrescriptionOptionCategory,
  type PrescriptionOptionsByCategory,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";
import { buildPrescriptionHtml, openPrintWindow, type PrintModel } from "./printPrescriptionHtml";

interface RxItem {
  id: number;
  medicine: MedicineRecord;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instruction: string;
}

const EMPTY_OPTIONS: PrescriptionOptionsByCategory = {
  ILLNESS: [],
  DURATION: [],
  BP: [],
  TEMPERATURE: [],
  PULSE: [],
  RESPIRATION: [],
  SPO2: [],
  WEIGHT: [],
  FREQUENCY: [],
  INSTRUCTION: [],
  ADVICE: [],
  ACTIVITY_LEVEL: [],
  PAST_HISTORY: [],
  DRUG_HISTORY: [],
  INVESTIGATIONS: [],
  DIAGNOSIS: [],
  TREATMENT_PLAN: [],
  OPERATION_NOTES: [],
  PHYSIOTHERAPY: [],
  NEXT_PLANS: [],
  HOSPITALIZATIONS: [],
};

const LEFT_SECTIONS = ["Activity Level", "Complaints", "On Examination", "Past History", "Drug History", "Investigations", "Diagnosis", "Treatment Plan", "Operation Notes"];
const RIGHT_SECTIONS = ["Physiotherapy", "Advices", "Next Plans", "Hospitalizations"];

/** Maps a Digital Prescription sidebar section to its Prescription Option category. */
const SECTION_CATEGORY: Record<string, PrescriptionOptionCategory> = {
  "Activity Level": "ACTIVITY_LEVEL",
  "Past History": "PAST_HISTORY",
  "Drug History": "DRUG_HISTORY",
  "Investigations": "INVESTIGATIONS",
  "Diagnosis": "DIAGNOSIS",
  "Treatment Plan": "TREATMENT_PLAN",
  "Operation Notes": "OPERATION_NOTES",
  "Physiotherapy": "PHYSIOTHERAPY",
  "Next Plans": "NEXT_PLANS",
  "Hospitalizations": "HOSPITALIZATIONS",
};

export function DigitalPrescriptionPage({ onBack }: { onBack?: () => void }) {
  const [selectedPatient, setSelectedPatient] = useState<PatientListRecord | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorRecord | null>(null);
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [complaints, setComplaints] = useState<{ name: string; duration: string }[]>([]);
  const [bp, setBp] = useState("");
  const [temp, setTemp] = useState("");
  const [pulse, setPulse] = useState("");
  const [resp, setResp] = useState("");
  const [spo2, setSpo2] = useState("");
  const [weight, setWeight] = useState("");
  const [rxItems, setRxItems] = useState<RxItem[]>([]);
  const [advice, setAdvice] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpAfter, setFollowUpAfter] = useState("");
  const [followUpUnit, setFollowUpUnit] = useState<"days" | "months" | "years">("days");
  const [referTo, setReferTo] = useState("");
  const [medSearch, setMedSearch] = useState("");
  const [medResults, setMedResults] = useState<MedicineRecord[]>([]);
  const [medSearching, setMedSearching] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const [saving, setSaving] = useState(false);
  const [savedNumber, setSavedNumber] = useState<string | null>(null);

  // Option lists loaded from Settings → Prescription Options (branch-scoped).
  const [options, setOptions] = useState<PrescriptionOptionsByCategory>(EMPTY_OPTIONS);

  // Patient search
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientListRecord[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [showPatientDrop, setShowPatientDrop] = useState(false);

  // Doctor search
  const [doctorSearch, setDoctorSearch] = useState("");
  const [showDoctorDrop, setShowDoctorDrop] = useState(false);

  // Collapsible sidebar sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "Complaints": true,
    "On Examination": true,
  });

  // Selected values for the configurable clinical sections (keyed by section label)
  const [sectionValues, setSectionValues] = useState<Record<string, string[]>>({});
  // Section picker modal
  const [sectionModal, setSectionModal] = useState<string | null>(null);
  const [sectionSearch, setSectionSearch] = useState("");
  const [sectionCustom, setSectionCustom] = useState("");

  // Medicine search toggle
  const [showRxSearch, setShowRxSearch] = useState(false);
  // Complaint picker modal
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [modalIllness, setModalIllness] = useState("");
  const [modalDuration, setModalDuration] = useState("");
  const [illnessSearch, setIllnessSearch] = useState("");
  // On Examination modal
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [expandedVital, setExpandedVital] = useState<string | null>(null);
  const [vitalSearch, setVitalSearch] = useState("");
  const [draftBp, setDraftBp] = useState("");
  const [draftTemp, setDraftTemp] = useState("");
  const [draftPulse, setDraftPulse] = useState("");
  const [draftResp, setDraftResp] = useState("");
  const [draftSpo2, setDraftSpo2] = useState("");
  const [draftWeight, setDraftWeight] = useState("");

  // Collapsible right-panel rows
  const [openRightSections, setOpenRightSections] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result = await settingsApi.prescriptionOptions.list();
        setOptions(result.options);
      } catch (err) {
        notify("error", errorMessage(err));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [notify]);

  const labels = (category: keyof PrescriptionOptionsByCategory) =>
    options[category].map((option) => option.label);
  const ILLNESSES = labels("ILLNESS");
  const DURATION_OPTIONS = labels("DURATION");
  const BP_OPTIONS = labels("BP");
  const TEMP_OPTIONS = labels("TEMPERATURE");
  const PULSE_OPTIONS = labels("PULSE");
  const RESP_OPTIONS = labels("RESPIRATION");
  const SPO2_OPTIONS = labels("SPO2");
  const WEIGHT_OPTIONS = labels("WEIGHT");
  const FREQ_OPTIONS = labels("FREQUENCY");
  const INSTRUCTION_OPTIONS = labels("INSTRUCTION");
  const ADVICE_OPTIONS = labels("ADVICE");

  // Patient search debounce
  useEffect(() => {
    if (!patientSearch.trim()) {
      setTimeout(() => setPatientResults([]), 0);
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
      setTimeout(() => setMedResults([]), 0);
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

  const filteredComplaints = ILLNESSES.filter(
    (c) => !complaints.some((x) => x.name === c) && c.toLowerCase().includes(illnessSearch.trim().toLowerCase()),
  );

  const addComplaint = (c: string) => {
    if (!c || complaints.some((x) => x.name === c)) return;
    setComplaints((prev) => [...prev, { name: c, duration: "" }]);
  };

  const removeComplaint = (name: string) => {
    setComplaints((prev) => prev.filter((x) => x.name !== name));
  };

  const setComplaintDuration = (name: string, duration: string) => {
    setComplaints((prev) => prev.map((c) => (c.name === name ? { ...c, duration } : c)));
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
    setShowRxSearch(false);
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

  const buildLocalModel = (rxNo: string): PrintModel | null => {
    if (!selectedPatient || !selectedDoctor) return null;
    const vitals = [
      { label: "Temperature", value: temp },
      { label: "Blood Pressure", value: bp ? `${bp}mmHg` : "" },
      { label: "Pulse", value: pulse },
      { label: "Respiration", value: resp },
      { label: "SpO2", value: spo2 },
      { label: "Weight", value: weight },
    ].filter((v) => v.value);

    const followUpText = [followUpDate || followUp, followUpAfter ? `After: ${followUpAfter} ${followUpUnit}` : ""]
      .filter(Boolean)
      .join(" · ");

    return {
      doctor: {
        name: selectedDoctor.name,
        qualification: selectedDoctor.qualification,
        specialization: selectedDoctor.specialization,
        bmdc: selectedDoctor.bmdcRegistrationNo,
        phone: selectedDoctor.phone,
        email: selectedDoctor.email,
        signature: selectedDoctor.signature,
      },
      patient: {
        name: selectedPatient.name,
        age: selectedPatient.dateOfBirth ? calcAge(selectedPatient.dateOfBirth) : "—",
        gender: selectedPatient.gender
          ? selectedPatient.gender.charAt(0) + selectedPatient.gender.slice(1).toLowerCase()
          : "—",
        code: selectedPatient.patientCode ?? "—",
      },
      date: new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
      rxNo,
      complaints: complaints.map((c) => ({ name: c.name, duration: c.duration || undefined })),
      vitals,
      items: rxItems.map((item) => ({
        title: item.medicine.brandName || item.medicine.genericName,
        generic: item.medicine.brandName ? item.medicine.genericName : "",
        frequency: item.frequency,
        dosage: item.dosage,
        duration: item.duration,
        instruction: item.instruction,
      })),
      advice: advice || undefined,
      followUp: followUpText || undefined,
      referTo: referTo || undefined,
      leftSections: LEFT_SECTIONS.filter((l) => SECTION_CATEGORY[l])
        .map((l) => ({ title: l, values: sectionValues[l] ?? [] }))
        .filter((s) => s.values.length > 0),
      rightSections: RIGHT_SECTIONS.filter((l) => SECTION_CATEGORY[l])
        .map((l) => ({ title: l, values: sectionValues[l] ?? [] }))
        .filter((s) => s.values.length > 0),
    };
  };

  const saveAndPrint = async () => {
    if (!selectedPatient) {
      notify("error", "Select a patient first.");
      return;
    }
    if (!selectedDoctor) {
      notify("error", "Select a doctor first.");
      return;
    }
    if (rxItems.length === 0) {
      notify("error", "Add at least one medicine before saving.");
      return;
    }
    setSaving(true);
    try {
      const vitals = [
        { label: "Temperature", value: temp },
        { label: "Blood Pressure", value: bp ? `${bp}mmHg` : "" },
        { label: "Pulse", value: pulse },
        { label: "Respiration", value: resp },
        { label: "SpO2", value: spo2 },
        { label: "Weight", value: weight },
      ].filter((v) => v.value);
      const followUpText = [
        followUpDate || followUp,
        followUpAfter ? `After: ${followUpAfter} ${followUpUnit}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      const created = await prescriptionApi.create({
        patientId: selectedPatient.id,
        doctorId: selectedDoctor.id,
        details: {
          complaints: complaints.map((c) => ({ name: c.name, duration: c.duration || null })),
          vitals,
          advice: advice || null,
          followUp: followUpText || null,
          referTo: referTo || null,
          ACTIVITY_LEVEL: sectionValues["Activity Level"] ?? [],
          PAST_HISTORY: sectionValues["Past History"] ?? [],
          DRUG_HISTORY: sectionValues["Drug History"] ?? [],
          INVESTIGATIONS: sectionValues["Investigations"] ?? [],
          DIAGNOSIS: sectionValues["Diagnosis"] ?? [],
          TREATMENT_PLAN: sectionValues["Treatment Plan"] ?? [],
          OPERATION_NOTES: sectionValues["Operation Notes"] ?? [],
          PHYSIOTHERAPY: sectionValues["Physiotherapy"] ?? [],
          NEXT_PLANS: sectionValues["Next Plans"] ?? [],
          HOSPITALIZATIONS: sectionValues["Hospitalizations"] ?? [],
        },
        items: rxItems.map((item) => ({
          medicineId: item.medicine.id,
          dosage: item.dosage || null,
          frequency: item.frequency || null,
          duration: item.duration || null,
          instruction: item.instruction || null,
        })),
      });
      setSavedNumber(created.prescriptionNumber);
      notify("success", `Prescription ${created.prescriptionNumber} saved.`);
      const model = buildLocalModel(created.prescriptionNumber);
      const opened = model ? openPrintWindow(buildPrescriptionHtml(model)) : false;
      if (!opened) setTimeout(() => print(), 200);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSelectedPatient(null);
    setPatientSearch("");
    setPatientResults([]);
    setComplaints([]);
    setBp("");
    setTemp("");
    setPulse("");
    setResp("");
    setSpo2("");
    setWeight("");
    setRxItems([]);
    setAdvice("");
    setFollowUp("");
    setFollowUpDate("");
    setFollowUpAfter("");
    setFollowUpUnit("days");
    setReferTo("");
    setMedSearch("");
    setMedResults([]);
    setSectionValues({});
    setSectionModal(null);
    setShowRxSearch(false);
    setOpenRightSections({});
    setSavedNumber(null);
  };

  const toggleSection = (name: string) => {
    setOpenSections((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleRightSection = (name: string) => {
    setOpenRightSections((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleSectionValue = (sec: string, value: string) => {
    setSectionValues((prev) => {
      const current = prev[sec] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [sec]: next };
    });
  };

  const removeSectionValue = (sec: string, value: string) => {
    setSectionValues((prev) => ({
      ...prev,
      [sec]: (prev[sec] ?? []).filter((v) => v !== value),
    }));
  };

  const addSectionCustom = (sec: string) => {
    const value = sectionCustom.trim();
    if (!value) return;
    setSectionValues((prev) => {
      const current = prev[sec] ?? [];
      if (current.includes(value)) return prev;
      return { ...prev, [sec]: [...current, value] };
    });
    setSectionCustom("");
  };

  const handlePickPatient = (p: PatientListRecord) => {
    setSelectedPatient(p);
    setPatientSearch("");
    setPatientResults([]);
    setShowPatientDrop(false);
  };

  const setQuickFollowUp = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    const iso = d.toISOString().slice(0, 10);
    setFollowUpDate(iso);
    setFollowUp(iso);
  };

  return (
    <div className="space-y-4 w-full">
      {onBack && (
        <button onClick={onBack} className="text-sm font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] cursor-pointer print:hidden">
          ← Back to Prescription Management
        </button>
      )}

      {/* Page header */}
      <div className="print:hidden">
        <h2 className="text-xl font-black text-[var(--primary-dark)]">Digital Prescription</h2>
        <p className="text-sm text-[var(--muted)]">Create and manage patient prescriptions.</p>
      </div>

      {/* Patient header bar (screen only) */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-base print:hidden">
        <span><span className="font-bold text-gray-700">Name:</span> {selectedPatient?.name ?? "—"}</span>
        <span><span className="font-bold text-gray-700">Age:</span> {selectedPatient?.dateOfBirth ? calcAge(selectedPatient.dateOfBirth) : "—"}</span>
        <span><span className="font-bold text-gray-700">Gender:</span> {selectedPatient?.gender ?? "—"}</span>
        <span><span className="font-bold text-gray-700">Date:</span> {new Date().toLocaleDateString()}</span>
        <span><span className="font-bold text-gray-700">ID:</span> {selectedPatient?.patientCode ?? "—"}</span>
      </div>

      {/* Doctor & Patient selectors (compact row) */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,16rem)_minmax(0,16rem)] gap-4 print:hidden">
        <div className="space-y-1 relative">
          <label className="text-sm font-bold text-gray-500">Doctor</label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <input
              type="text"
              value={selectedDoctor ? selectedDoctor.name : doctorSearch}
              onChange={(e) => { setDoctorSearch(e.target.value); if (selectedDoctor) setSelectedDoctor(null); setShowDoctorDrop(true); }}
              onFocus={() => setShowDoctorDrop(true)}
              placeholder="Search doctor by name..."
              className="pl-9 w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
            />
          </div>
          {showDoctorDrop && (
            <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
              {(doctorSearch.trim() ? filteredDoctors : doctors).map((d) => (
                <button key={d.id} type="button" onClick={() => { setSelectedDoctor(d); setDoctorSearch(""); setShowDoctorDrop(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 cursor-pointer border-b border-gray-100 last:border-0">
                  <span className="font-bold text-gray-800">{d.name}</span>
                  {d.qualification && <span className="text-gray-500 ml-1">({d.qualification})</span>}
                  {d.specialization && <span className="text-gray-400 ml-2 text-[12px]">{d.specialization}</span>}
                </button>
              ))}
              {filteredDoctors.length === 0 && doctorSearch.trim() && (
                <div className="px-3 py-2 text-sm text-gray-400">No doctors match.</div>
              )}
            </div>
          )}
        </div>
        <div className="space-y-1 relative">
          <label className="text-sm font-bold text-gray-500">Patient</label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              onFocus={() => setShowPatientDrop(true)}
              placeholder="Search patient by name, code, phone..."
              className="pl-9 w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
            />
            {patientSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">Searching…</span>
            )}
          </div>
          {showPatientDrop && patientResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
              {patientResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePickPatient(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 cursor-pointer border-b border-gray-100 last:border-0"
                >
                  <span className="font-bold text-gray-800">{p.name}</span>
                  <span className="text-[12px] text-gray-400 ml-2">{p.patientCode}</span>
                  {p.gender && <span className="text-[12px] text-gray-400 ml-2">{p.gender}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Two-column body (screen only) */}
      <div className="flex flex-nowrap gap-0 border border-gray-200 rounded-lg bg-white overflow-hidden print:hidden">
        {/* Left sidebar */}
        <div className="w-[180px] shrink-0 border-r border-gray-200 p-3 print:w-[28%]">
          <div className="space-y-3">
            {LEFT_SECTIONS.map((sec) => (
              <div key={sec}>
                <button
                  type="button"
                  onClick={() => {
                    if (sec === "Complaints") {
                      setModalIllness(""); setModalDuration(""); setIllnessSearch(""); setComplaintModalOpen(true);
                    } else if (sec === "On Examination") {
                      setDraftBp(bp); setDraftTemp(temp); setDraftPulse(pulse);
                      setDraftResp(resp); setDraftSpo2(spo2); setDraftWeight(weight);
                      setExpandedVital(null); setVitalSearch(""); setExamModalOpen(true);
                    } else if (SECTION_CATEGORY[sec]) {
                      setSectionSearch(""); setSectionCustom(""); setSectionModal(sec);
                    } else {
                      toggleSection(sec);
                    }
                  }}
                  className="text-sm font-semibold text-gray-600 hover:text-teal-700 hover:underline cursor-pointer flex items-center gap-1"
                >
                  {sec}
                  <FiPlus className="w-3 h-3 text-green-600" />
                </button>
                {openSections[sec] && sec === "Complaints" && (
                  <div className="mt-1 ml-1 space-y-1">
                    {complaints.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {complaints.map((c) => (
                          <span key={c.name} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-teal-200 bg-teal-50 text-[12px] font-semibold text-gray-800">
                            {c.name}{c.duration ? ` — ${c.duration}` : ""}
                            <button type="button" onClick={() => removeComplaint(c.name)} className="text-gray-400 hover:text-rose-500 cursor-pointer ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    {complaints.filter((c) => !c.duration).map((c) => (
                      <div key={c.name} className="mt-1">
                        <span className="text-[12px] text-gray-500">{c.name} — for how many days?</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {DURATION_OPTIONS.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setComplaintDuration(c.name, d)}
                              className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[11px] text-gray-600 hover:bg-teal-50 cursor-pointer"
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {openSections[sec] && sec === "On Examination" && (
                  <div className="mt-1 ml-1 space-y-1">
                    {(bp || temp || pulse || resp || spo2 || weight) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {bp && <span className="px-1.5 py-0.5 rounded border border-teal-200 bg-teal-50 text-[12px] text-teal-700">BP {bp}</span>}
                        {temp && <span className="px-1.5 py-0.5 rounded border border-teal-200 bg-teal-50 text-[12px] text-teal-700">Temp {temp}</span>}
                        {pulse && <span className="px-1.5 py-0.5 rounded border border-teal-200 bg-teal-50 text-[12px] text-teal-700">Pulse {pulse}</span>}
                        {resp && <span className="px-1.5 py-0.5 rounded border border-teal-200 bg-teal-50 text-[12px] text-teal-700">Resp {resp}</span>}
                        {spo2 && <span className="px-1.5 py-0.5 rounded border border-teal-200 bg-teal-50 text-[12px] text-teal-700">SpO2 {spo2}</span>}
                        {weight && <span className="px-1.5 py-0.5 rounded border border-teal-200 bg-teal-50 text-[12px] text-teal-700">Weight {weight}</span>}
                      </div>
                    )}
                  </div>
                )}
                {SECTION_CATEGORY[sec] && (sectionValues[sec]?.length ?? 0) > 0 && (
                  <div className="mt-1 ml-1 flex flex-wrap gap-1">
                    {sectionValues[sec].map((v) => (
                      <span key={v} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-teal-200 bg-teal-50 text-[12px] font-semibold text-gray-800">
                        {v}
                        <button type="button" onClick={() => removeSectionValue(sec, v)} className="text-gray-400 hover:text-rose-500 cursor-pointer ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

          {/* Right panel */}
          <div className="flex-1 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl font-bold text-gray-800">Rx</span>
              <button
                type="button"
                onClick={() => setShowRxSearch((v) => !v)}
                className="text-green-600 font-bold text-xl cursor-pointer hover:text-green-700"
                title="Add medicine"
              >
                +
              </button>
            </div>

            {showRxSearch && (
              <div className="relative mb-3">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <input
                  value={medSearch}
                  onChange={(e) => setMedSearch(e.target.value)}
                  placeholder="Search medicine by name..."
                  className="pl-8 w-full max-w-[16rem] h-8 rounded-md border border-gray-300 bg-white px-2.5 text-sm outline-none focus:border-teal-600"
                />
                {medSearching && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">Searching…</span>
                )}
                {medResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-w-[16rem] max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                    {medResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => addMedicine(m)}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-teal-50 cursor-pointer border-b border-gray-100 last:border-0"
                      >
                        <span className="font-bold text-gray-800">{m.genericName}</span>
                        {m.brandName && <span className="text-gray-500"> ({m.brandName})</span>}
                        <span className="text-[12px] text-gray-400 ml-2">{m.medicineCode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {rxItems.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No medicines added.</p>
            ) : (
              <ol className="text-base space-y-3">
                {rxItems.map((item, idx) => (
                  <li key={item.id} className="border-b border-gray-100 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-gray-800">
                        {idx + 1}. {item.medicine.genericName}
                        {item.medicine.brandName && <span className="font-normal text-gray-500"> ({item.medicine.brandName})</span>}
                      </span>
                      <button type="button" onClick={() => removeRx(item.id)} className="text-rose-400 hover:text-rose-600 cursor-pointer shrink-0">
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1 ml-5">
                      {FREQ_OPTIONS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => updateRx(item.id, { frequency: item.frequency === f ? "" : f })}
                          className={`px-1.5 py-0.5 rounded border text-[11px] cursor-pointer ${item.frequency === f ? "border-teal-500 bg-teal-50 text-teal-700 font-bold" : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-teal-50"}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1 ml-5">
                      {INSTRUCTION_OPTIONS.map((ins) => (
                        <button
                          key={ins}
                          type="button"
                          onClick={() => updateRx(item.id, { instruction: item.instruction === ins ? "" : ins })}
                          className={`px-1.5 py-0.5 rounded border text-[11px] cursor-pointer ${item.instruction === ins ? "border-teal-500 bg-teal-50 text-teal-700 font-bold" : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-teal-50"}`}
                        >
                          {ins}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-4 pt-3 border-t border-gray-200 space-y-3">
              {RIGHT_SECTIONS.map((sec) => (
                <div key={sec}>
                  <button
                    type="button"
                    onClick={() => {
                      if (SECTION_CATEGORY[sec]) {
                        setSectionSearch(""); setSectionCustom(""); setSectionModal(sec);
                      } else {
                        toggleRightSection(sec);
                      }
                    }}
                    className="text-sm font-semibold text-gray-600 hover:text-teal-700 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {sec}
                    <FiPlus className="w-3 h-3 text-green-600" />
                  </button>
                  {openRightSections[sec] && sec === "Advices" && (
                    <div className="mt-1 ml-1 space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {ADVICE_OPTIONS.map((a) => {
                            const selected = advice.includes(a);
                            return (
                              <button
                                key={a}
                                type="button"
                                onClick={() => {
                                  if (selected) {
                                    setAdvice((prev) => prev.split("\n").filter((x) => x.trim() !== a).join("\n").trim());
                                  } else {
                                    setAdvice((prev) => (prev.trim() ? prev.trim() + "\n" + a : a));
                                  }
                                }}
                                className={`px-1.5 py-0.5 rounded border text-[11px] cursor-pointer ${selected ? "border-teal-500 bg-teal-50 text-teal-700 font-bold" : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-teal-50"}`}
                              >
                                {a}
                              </button>
                            );
                          })}
                        </div>
                      <textarea
                        value={advice}
                        onChange={(e) => setAdvice(e.target.value)}
                        placeholder="Additional advice..."
                        className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-teal-600 min-h-[48px]"
                        rows={2}
                      />
                    </div>
                  )}
                  {SECTION_CATEGORY[sec] && (sectionValues[sec]?.length ?? 0) > 0 && (
                    <div className="mt-1 ml-1 flex flex-wrap gap-1">
                      {sectionValues[sec].map((v) => (
                        <span key={v} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-teal-200 bg-teal-50 text-[12px] font-semibold text-gray-800">
                          {v}
                          <button type="button" onClick={() => removeSectionValue(sec, v)} className="text-gray-400 hover:text-rose-500 cursor-pointer ml-0.5">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Next Follow up */}
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-0 space-y-2">
                  <label className="text-[13px] font-bold text-gray-500 block mb-1">Next Follow up</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => { setFollowUpDate(e.target.value); setFollowUp(e.target.value); }}
                      className="h-8 rounded-md border border-gray-300 bg-white px-2.5 text-sm outline-none focus:border-teal-600 w-[180px]"
                    />
                    <div className="flex gap-1">
                      {[1, 7, 15, 30, 90, 180].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setQuickFollowUp(n)}
                          className="h-8 px-2 rounded-md border border-gray-300 bg-gray-50 text-[13px] font-semibold text-gray-600 hover:bg-teal-50 hover:border-teal-400 cursor-pointer"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[13px] text-gray-500">After:</span>
                    <input
                      type="text"
                      value={followUpAfter}
                      onChange={(e) => { setFollowUpAfter(e.target.value); setFollowUp(`${e.target.value} ${followUpUnit}`.trim()); }}
                      placeholder="e.g. 7"
                      className="h-8 w-16 rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-600"
                    />
                    <label className="inline-flex items-center gap-1 text-[13px] text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={followUpUnit === "days"} onChange={() => setFollowUpUnit("days")} className="w-3.5 h-3.5" />
                      দিন
                    </label>
                    <label className="inline-flex items-center gap-1 text-[13px] text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={followUpUnit === "months"} onChange={() => setFollowUpUnit("months")} className="w-3.5 h-3.5" />
                      মাস
                    </label>
                    <label className="inline-flex items-center gap-1 text-[13px] text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={followUpUnit === "years"} onChange={() => setFollowUpUnit("years")} className="w-3.5 h-3.5" />
                      বছর
                    </label>
                  </div>
                </div>
                <div className="w-[200px] shrink-0">
                  <label className="text-[13px] font-bold text-gray-500 block mb-1">Refer to</label>
                  <input
                    type="text"
                    value={referTo}
                    onChange={(e) => setReferTo(e.target.value)}
                    placeholder="Enter doctor name..."
                    className="w-full h-8 rounded-md border border-gray-300 bg-white px-2.5 text-sm outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-gray-200 mt-4">
                <button
                  onClick={saveAndPrint}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-md text-sm font-bold text-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: "#2f7d5b" }}
                >
                  <FiPrinter className="w-3.5 h-3.5" />
                  {saving ? "Saving…" : "Save and Print"}
                </button>
                <button
                  onClick={reset}
                  className="px-4 py-2 rounded-md text-sm font-bold border border-gray-300 text-gray-500 hover:bg-gray-50 cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Printable prescription */}
        <div className="hidden print:block p-4">
          <div className="mx-auto w-full max-w-[820px] bg-white font-serif text-black">
            {/* Doctor header */}
            <div
              className="grid grid-cols-2 gap-3 px-3 pt-2 pb-1.5 border-b-2"
              style={{ borderColor: "#217a3c" }}
            >
              <div className="leading-tight">
                <h1 className="text-2xl font-bold" style={{ color: "#217a3c" }}>
                  {selectedDoctor ? selectedDoctor.name : "Doctor Name"}
                </h1>
                {selectedDoctor?.qualification && (
                  <p className="text-base font-semibold" style={{ color: "#b42318" }}>
                    {selectedDoctor.qualification}
                  </p>
                )}
                {selectedDoctor?.specialization && (
                  <p className="text-base font-semibold" style={{ color: "#b42318" }}>
                    {selectedDoctor.specialization}
                  </p>
                )}
                {selectedDoctor?.bmdcRegistrationNo && (
                  <p className="text-base font-semibold" style={{ color: "#b42318" }}>
                    BMDC Reg: {selectedDoctor.bmdcRegistrationNo}
                  </p>
                )}
              </div>
              <div className="text-right leading-tight" style={{ color: "#b42318" }}>
                {selectedDoctor?.phone && <p className="text-base">{selectedDoctor.phone}</p>}
                {selectedDoctor?.email && <p className="text-base">{selectedDoctor.email}</p>}
              </div>
            </div>

            {/* Patient strip */}
            <div
              className="px-3 py-1 text-base border-b-2"
              style={{ borderColor: "#217a3c" }}
            >
              <span className="font-bold">Name:</span>{" "}
              {selectedPatient?.name ?? "—"}
              {`    `}
              <span className="font-bold">Age:</span>{" "}
              {selectedPatient?.dateOfBirth ? calcAge(selectedPatient.dateOfBirth) : "—"}
              {` | `}
              <span className="font-bold">Gender:</span>{" "}
              {selectedPatient?.gender
                ? selectedPatient.gender.charAt(0) + selectedPatient.gender.slice(1).toLowerCase()
                : "—"}
              {` | `}
              <span className="font-bold">Date:</span>{" "}
              {new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}
              {` | `}
              <span className="font-bold">ID:</span>{" "}
              {selectedPatient?.patientCode ?? "—"}
              {` | `}
              <span className="font-bold">Rx No:</span>{" "}
              {savedNumber ?? "—"}
            </div>

            {/* Body */}
            <div className="flex pt-2" style={{ minHeight: "300px" }}>
              <div className="w-[26%] border-r border-black px-2 py-2">
                {/* Barcode */}
                <svg
                  viewBox="0 0 200 36"
                  style={{ width: 144, height: 36 }}
                  className="mb-3"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <rect x={2} y={2} width={2} height={32} fill="#111" />
                  <rect x={5} y={2} width={1} height={32} fill="#111" />
                  <rect x={7} y={2} width={3} height={32} fill="#111" />
                  <rect x={11} y={2} width={2} height={32} fill="#111" />
                  <rect x={14} y={2} width={1} height={32} fill="#111" />
                  <rect x={16} y={2} width={4} height={32} fill="#111" />
                  <rect x={21} y={2} width={2} height={32} fill="#111" />
                  <rect x={24} y={2} width={1} height={32} fill="#111" />
                  <rect x={26} y={2} width={2} height={32} fill="#111" />
                  <rect x={29} y={2} width={1} height={32} fill="#111" />
                  <rect x={31} y={2} width={3} height={32} fill="#111" />
                  <rect x={35} y={2} width={2} height={32} fill="#111" />
                  <rect x={38} y={2} width={1} height={32} fill="#111" />
                  <rect x={40} y={2} width={2} height={32} fill="#111" />
                  <rect x={43} y={2} width={1} height={32} fill="#111" />
                  <rect x={45} y={2} width={3} height={32} fill="#111" />
                  <rect x={49} y={2} width={2} height={32} fill="#111" />
                  <rect x={52} y={2} width={1} height={32} fill="#111" />
                  <rect x={54} y={2} width={2} height={32} fill="#111" />
                  <rect x={57} y={2} width={1} height={32} fill="#111" />
                  <rect x={59} y={2} width={4} height={32} fill="#111" />
                  <rect x={64} y={2} width={2} height={32} fill="#111" />
                  <rect x={67} y={2} width={1} height={32} fill="#111" />
                  <rect x={69} y={2} width={3} height={32} fill="#111" />
                  <rect x={73} y={2} width={2} height={32} fill="#111" />
                  <rect x={76} y={2} width={1} height={32} fill="#111" />
                  <rect x={78} y={2} width={2} height={32} fill="#111" />
                  <rect x={81} y={2} width={1} height={32} fill="#111" />
                  <rect x={83} y={2} width={3} height={32} fill="#111" />
                </svg>

                {complaints.length > 0 && (
                  <div className="mb-3">
                    <p className="font-bold text-base mb-0.5">Complaints:</p>
                    <ul className="text-base">
                      {complaints.map((c) => (
                        <li key={c.name} className="mb-0.5">
                          <span>• {c.name}</span>
                          {c.duration ? <span className="block pl-3 text-sm">{c.duration}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(bp || temp || pulse || resp || spo2 || weight) && (
                  <div>
                    <p className="font-bold text-base mb-0.5">On Examination:</p>
                    <ul className="text-base">
                      {temp && (
                        <li className="mb-0.5">
                          <span>• Temperature</span>
                          <span className="block pl-3 text-sm">{temp}</span>
                        </li>
                      )}
                      {bp && (
                        <li className="mb-0.5">
                          <span>• Blood Pressure</span>
                          <span className="block pl-3 text-sm">{bp}mmHg</span>
                        </li>
                      )}
                      {pulse && (
                        <li className="mb-0.5">
                          <span>• Pulse</span>
                          <span className="block pl-3 text-sm">{pulse}</span>
                        </li>
                      )}
                      {resp && (
                        <li className="mb-0.5">
                          <span>• Respiration</span>
                          <span className="block pl-3 text-sm">{resp}</span>
                        </li>
                      )}
                      {spo2 && (
                        <li className="mb-0.5">
                          <span>• SpO2</span>
                          <span className="block pl-3 text-sm">{spo2}</span>
                        </li>
                      )}
                      {weight && (
                        <li className="mb-0.5">
                          <span>• Weight</span>
                          <span className="block pl-3 text-sm">{weight}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <div className="w-[74%] px-2 py-2">
                <p className="font-bold text-2xl mt-10 mb-1">Rx</p>
                {rxItems.length > 0 && (
                  <ol className="text-base">
                    {rxItems.map((item, idx) => {
                      const title = item.medicine.brandName || item.medicine.genericName;
                      const generic = item.medicine.brandName ? item.medicine.genericName : "";
                      return (
                        <li key={item.id} className="mb-1.5 pb-1 border-b border-dotted border-gray-400">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-bold">
                              {idx + 1}. Tab. {title}
                              {generic ? <span className="font-normal"> ({generic})</span> : null}
                            </span>
                            {item.instruction && (
                              <span className="shrink-0 text-sm italic">{item.instruction}</span>
                            )}
                            {item.duration && <span className="shrink-0 text-sm">{item.duration}</span>}
                          </div>
                          {(item.frequency || item.dosage) && (
                            <div className="pl-4 text-sm">
                              {item.frequency}
                              {item.frequency && item.dosage ? " · " : ""}
                              {item.dosage}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}

                {advice && (
                  <div className="mt-3 border-t border-black pt-1.5">
                    <p className="font-bold text-base">Advices:</p>
                    <p className="text-base pl-2 whitespace-pre-line">{advice}</p>
                  </div>
                )}

                {(followUp || followUpDate || followUpAfter || referTo) && (
                  <p className="text-base mt-2">
                    <span className="font-bold">Follow up:</span>{" "}
                    {followUpDate || followUp}
                    {followUpAfter && ` (After: ${followUpAfter} ${followUpUnit})`}
                    {referTo && ` — Refer to: ${referTo}`}
                  </p>
                )}
              </div>
            </div>

            {/* Signature */}
            <div className="mt-6 flex justify-end px-6 pb-3">
              <div className="text-center">
                {selectedDoctor?.signature ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedDoctor.signature}
                    alt="Doctor signature"
                    className="h-14 object-contain mx-auto"
                  />
                ) : (
                  <div className="h-14" />
                )}
                <div className="w-44 border-t border-black pt-0.5 text-sm">Doctor&apos;s Signature</div>
              </div>
            </div>
          </div>
        </div>

        {/* Complaint picker modal */}
        {complaintModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 print:hidden" onClick={() => { setIllnessSearch(""); setComplaintModalOpen(false); }}>
            <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-md p-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold text-gray-800 mb-2">Add Complaint</h3>
              <div className="relative mb-2">
                <FiSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={illnessSearch}
                  onChange={(e) => setIllnessSearch(e.target.value)}
                  placeholder="Search illness..."
                  className="w-full h-8 rounded border border-gray-300 pl-8 pr-2 text-[13px] outline-none focus:border-teal-600"
                />
              </div>
              <p className="text-[13px] text-gray-500 mb-2">Select an illness:</p>
              <div className="flex flex-wrap gap-1.5 mb-3 max-h-40 overflow-y-auto">
                {filteredComplaints.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setModalIllness(c); setModalDuration(""); }}
                    className={`px-2 py-1 rounded border text-[13px] cursor-pointer ${modalIllness === c ? "border-teal-500 bg-teal-50 text-teal-700 font-bold" : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-teal-50"}`}
                  >
                    {c}
                  </button>
                ))}
                {filteredComplaints.length === 0 && (
                  <span className="text-[13px] text-gray-400 italic">
                    {illnessSearch.trim()
                      ? "No matching illness found."
                      : ILLNESSES.length === 0
                        ? "No complaints configured in settings yet."
                        : "All illnesses added."}
                  </span>
                )}
              </div>
              {modalIllness && (
                <div className="mb-3">
                  <p className="text-[13px] text-gray-500 mb-1">{modalIllness} — for how many days?</p>
                  <div className="flex flex-wrap gap-1">
                    {DURATION_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setModalDuration(d)}
                        className={`px-2 py-1 rounded border text-[12px] cursor-pointer ${modalDuration === d ? "border-teal-500 bg-teal-50 text-teal-700 font-bold" : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-teal-50"}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setIllnessSearch(""); setComplaintModalOpen(false); }}
                  className="px-3 py-1.5 rounded text-sm font-bold border border-gray-300 text-gray-500 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!modalIllness) return;
                    addComplaint(modalIllness);
                    if (modalDuration) setComplaintDuration(modalIllness, modalDuration);
                    setComplaintModalOpen(false);
                    setModalIllness("");
                    setModalDuration("");
                    setIllnessSearch("");
                  }}
                  disabled={!modalIllness}
                  className="px-4 py-1.5 rounded text-sm font-bold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "#2f7d5b" }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* On Examination modal */}
        {examModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 print:hidden" onClick={() => { setExpandedVital(null); setVitalSearch(""); setExamModalOpen(false); }}>
            <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-md p-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold text-gray-800 mb-3">On Examination</h3>
              <div className="relative mb-3">
                <FiSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={vitalSearch}
                  onChange={(e) => setVitalSearch(e.target.value)}
                  placeholder="Search vital..."
                  className="w-full h-8 rounded border border-gray-300 pl-8 pr-2 text-[13px] outline-none focus:border-teal-600"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "BP", value: draftBp, set: setDraftBp, options: BP_OPTIONS },
                  { label: "Temp", value: draftTemp, set: setDraftTemp, options: TEMP_OPTIONS },
                  { label: "Pulse", value: draftPulse, set: setDraftPulse, options: PULSE_OPTIONS },
                  { label: "Resp", value: draftResp, set: setDraftResp, options: RESP_OPTIONS },
                  { label: "SpO2", value: draftSpo2, set: setDraftSpo2, options: SPO2_OPTIONS },
                  { label: "Weight", value: draftWeight, set: setDraftWeight, options: WEIGHT_OPTIONS },
                ].filter((v) => v.label.toLowerCase().includes(vitalSearch.trim().toLowerCase())).map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => setExpandedVital(expandedVital === v.label ? null : v.label)}
                    className={`px-3 py-2 rounded border text-[13px] font-bold cursor-pointer ${expandedVital === v.label ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-teal-50"}`}
                  >
                    {v.label}{v.value ? `: ${v.value}` : ""}
                  </button>
                ))}
                {vitalSearch.trim() && !["BP", "Temp", "Pulse", "Resp", "SpO2", "Weight"].some((l) => l.toLowerCase().includes(vitalSearch.trim().toLowerCase())) && (
                  <p className="col-span-3 text-[13px] text-gray-400 italic">No matching vital found.</p>
                )}
              </div>
              {expandedVital && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-[13px] font-bold text-gray-600 mb-1">
                    {expandedVital} — select value:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(
                      expandedVital === "BP" ? BP_OPTIONS :
                      expandedVital === "Temp" ? TEMP_OPTIONS :
                      expandedVital === "Pulse" ? PULSE_OPTIONS :
                      expandedVital === "Resp" ? RESP_OPTIONS :
                      expandedVital === "SpO2" ? SPO2_OPTIONS :
                      WEIGHT_OPTIONS
                    ).map((opt) => {
                      const cur =
                        expandedVital === "BP" ? draftBp :
                        expandedVital === "Temp" ? draftTemp :
                        expandedVital === "Pulse" ? draftPulse :
                        expandedVital === "Resp" ? draftResp :
                        expandedVital === "SpO2" ? draftSpo2 : draftWeight;
                      const setCur =
                        expandedVital === "BP" ? setDraftBp :
                        expandedVital === "Temp" ? setDraftTemp :
                        expandedVital === "Pulse" ? setDraftPulse :
                        expandedVital === "Resp" ? setDraftResp :
                        expandedVital === "SpO2" ? setDraftSpo2 : setDraftWeight;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setCur(cur === opt ? "" : opt)}
                          className={`px-2 py-1 rounded border text-[12px] cursor-pointer ${cur === opt ? "border-teal-500 bg-teal-50 text-teal-700 font-bold" : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-teal-50"}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setExpandedVital(null); setVitalSearch(""); setExamModalOpen(false); }}
                  className="px-3 py-1.5 rounded text-sm font-bold border border-gray-300 text-gray-500 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBp(draftBp); setTemp(draftTemp); setPulse(draftPulse);
                    setResp(draftResp); setSpo2(draftSpo2); setWeight(draftWeight);
                    setExpandedVital(null);
                    setVitalSearch("");
                    setExamModalOpen(false);
                  }}
                  className="px-4 py-1.5 rounded text-sm font-bold text-white cursor-pointer"
                  style={{ background: "#2f7d5b" }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section option picker modal */}
        {sectionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 print:hidden" onClick={() => setSectionModal(null)}>
            <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-md p-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold text-gray-800 mb-2">{sectionModal}</h3>
              <div className="relative mb-2">
                <FiSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={sectionSearch}
                  onChange={(e) => setSectionSearch(e.target.value)}
                  placeholder="Search options..."
                  className="w-full h-8 rounded border border-gray-300 pl-8 pr-2 text-[13px] outline-none focus:border-teal-600"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3 max-h-40 overflow-y-auto">
                {options[SECTION_CATEGORY[sectionModal]]
                  .map((o) => o.label)
                  .filter((label) => label.toLowerCase().includes(sectionSearch.trim().toLowerCase()))
                  .map((label) => {
                    const selected = (sectionValues[sectionModal] ?? []).includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleSectionValue(sectionModal, label)}
                        className={`px-2 py-1 rounded border text-[13px] cursor-pointer ${selected ? "border-teal-500 bg-teal-50 text-teal-700 font-bold" : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-teal-50"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                {options[SECTION_CATEGORY[sectionModal]].length === 0 && (
                  <span className="text-[13px] text-gray-400 italic">
                    No options configured in Prescription Options yet. Add one below.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={sectionCustom}
                  onChange={(e) => setSectionCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSectionCustom(sectionModal);
                    }
                  }}
                  placeholder="Type a custom value..."
                  className="min-w-0 flex-1 h-8 rounded border border-gray-300 px-2 text-[13px] outline-none focus:border-teal-600"
                />
                <button
                  type="button"
                  onClick={() => addSectionCustom(sectionModal)}
                  disabled={!sectionCustom.trim()}
                  className="px-3 py-1.5 rounded text-sm font-bold text-white cursor-pointer disabled:opacity-50"
                  style={{ background: "#2f7d5b" }}
                >
                  Add
                </button>
              </div>
              {(sectionValues[sectionModal]?.length ?? 0) > 0 && (
                <div className="mb-3">
                  <p className="text-[13px] text-gray-500 mb-1">Selected:</p>
                  <div className="flex flex-wrap gap-1">
                    {sectionValues[sectionModal].map((v) => (
                      <span key={v} className="inline-flex items-center gap-0.5 px-2 py-1 rounded border border-teal-300 bg-teal-50 text-[12px] font-semibold text-teal-700">
                        {v}
                        <button type="button" onClick={() => removeSectionValue(sectionModal, v)} className="text-gray-400 hover:text-rose-500 cursor-pointer ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSectionModal(null)}
                  className="px-4 py-1.5 rounded text-sm font-bold text-white cursor-pointer"
                  style={{ background: "#2f7d5b" }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      </div>
  );
}