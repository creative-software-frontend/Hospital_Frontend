// app/patients/PatientFormModal.tsx
// Create / edit patient modal. Mirrors the backend create/update validation
// schemas and surfaces field-level errors returned by the API.

"use client";

import { useState } from "react";
import { FiX, FiPlus, FiTrash2, FiSave } from "react-icons/fi";
import {
  patientApi,
  type CreatePatientInput,
  type Gender,
  type BloodGroup,
  type MaritalStatus,
  type PatientDetail,
  type PatientListRecord,
  ValidationError,
  errorMessage,
} from "@/app/lib/api";
import {
  GENDER_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  MARITAL_STATUS_OPTIONS,
} from "@/app/patients/constants";

interface ContactDraft {
  name: string;
  relationship: string;
  phone: string;
  address: string;
  isPrimary: boolean;
}

interface FormState {
  patientCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  maritalStatus: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  nationalId: string;
  occupation: string;
  photo: string;
}

const EMPTY_FORM: FormState = {
  patientCode: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  bloodGroup: "",
  maritalStatus: "",
  phone: "",
  email: "",
  address: "",
  district: "",
  nationalId: "",
  occupation: "",
  photo: "",
};

function prefillFromPatient(p: PatientDetail | PatientListRecord | null): FormState {
  if (!p) return EMPTY_FORM;
  return {
    patientCode: p.patientCode ?? "",
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : "",
    gender: p.gender ?? "",
    bloodGroup: p.bloodGroup ?? "",
    maritalStatus: p.maritalStatus ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    address: p.address ?? "",
    district: p.district ?? "",
    nationalId: (p as PatientDetail).nationalId ?? "",
    occupation: (p as PatientDetail).occupation ?? "",
    photo: (p as PatientDetail).photo ?? "",
  };
}

const inputCls =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";
const selectCls = inputCls;
const labelCls = "block text-[11px] font-bold text-[var(--muted)] mb-1.5 uppercase tracking-wider";

export function PatientFormModal({
  mode,
  patient,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  patient: PatientDetail | PatientListRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => prefillFromPatient(patient));
  const [contacts, setContacts] = useState<ContactDraft[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFieldErrors((prev) => ({ ...prev, [key]: "" }));
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const updateContact = (idx: number, key: keyof ContactDraft, value: string | boolean) => {
    setContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, [key]: value } : c)));
  };

  const addContact = () =>
    setContacts((prev) => [
      ...prev,
      { name: "", relationship: "", phone: "", address: "", isPrimary: prev.length === 0 },
    ]);

  const removeContact = (idx: number) => setContacts((prev) => prev.filter((_, i) => i !== idx));

  const buildInput = (): CreatePatientInput => {
    const opt = (v: string): string | undefined => (v.trim() === "" ? undefined : v.trim());
    const hasGender = GENDER_OPTIONS.some((g) => g.value === form.gender);
    const hasBlood = (BLOOD_GROUP_OPTIONS as string[]).includes(form.bloodGroup);
    const hasMarital = MARITAL_STATUS_OPTIONS.some((m) => m.value === form.maritalStatus);
    return {
      patientCode: form.patientCode.trim(),
      firstName: form.firstName.trim(),
      lastName: opt(form.lastName),
      dateOfBirth: opt(form.dateOfBirth),
      gender: hasGender ? (form.gender as Gender) : undefined,
      bloodGroup: hasBlood ? (form.bloodGroup as BloodGroup) : undefined,
      maritalStatus: hasMarital ? (form.maritalStatus as MaritalStatus) : undefined,
      phone: opt(form.phone),
      email: opt(form.email),
      address: opt(form.address),
      district: opt(form.district),
      nationalId: opt(form.nationalId),
      occupation: opt(form.occupation),
      photo: opt(form.photo),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.firstName.trim() || (mode === "create" && !form.patientCode.trim())) {
      setFormError(mode === "create"
        ? "Patient Code and First Name are required."
        : "First Name is required.");
      return;
    }

    const input = buildInput();
    const mappedContacts: NonNullable<CreatePatientInput["contacts"]> = contacts
      .filter((c) => c.name.trim() !== "")
      .map((c) => ({
        name: c.name.trim(),
        relationship: c.relationship.trim() === "" ? undefined : c.relationship.trim(),
        phone: c.phone.trim() === "" ? undefined : c.phone.trim(),
        address: c.address.trim() === "" ? undefined : c.address.trim(),
        isPrimary: c.isPrimary,
      }));

    setSubmitting(true);
    try {
      if (mode === "create") {
        await patientApi.create(mappedContacts.length > 0 ? { ...input, contacts: mappedContacts } : input);
      } else if (patient) {
        await patientApi.update(patient.id, input);
      }
      onSaved();
    } catch (err) {
      if (err instanceof ValidationError) {
        setFieldErrors(err.fieldErrors ?? {});
        setFormError(err.message);
      } else {
        setFormError(errorMessage(err));
      }
      setSubmitting(false);
    }
  };

  const fieldError = (key: string) =>
    fieldErrors[key] ? <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors[key]}</p> : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={() => !submitting && onClose()} />

      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] animate-[scaleIn_0.25s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
              {mode === "create" ? "Patient Management" : "Patient Management"}
            </span>
            <h3 className="font-black text-lg text-[var(--primary-dark)]">
              {mode === "create" ? "Register New Patient" : `Edit Patient ${patient?.patientCode ?? ""}`}
            </h3>
          </div>
          <button
            onClick={() => !submitting && onClose()}
            className="p-2 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 news-scroll">
            {formError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs font-semibold text-rose-600">
                {formError}
              </div>
            )}

            {/* Identity */}
            <div>
              <h4 className="text-xs font-extrabold text-[var(--text)] mb-3 uppercase tracking-wider">Identity</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mode === "create" && (
                  <div>
                    <label className={labelCls}>Patient Code *</label>
                    <input
                      className={inputCls}
                      value={form.patientCode}
                      onChange={set("patientCode")}
                      placeholder="e.g. PT-1001 (unique per branch)"
                      disabled={submitting}
                    />
                    {fieldError("patientCode")}
                  </div>
                )}
                <div>
                  <label className={labelCls}>First Name *</label>
                  <input className={inputCls} value={form.firstName} onChange={set("firstName")} placeholder="First name" disabled={submitting} />
                  {fieldError("firstName")}
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input className={inputCls} value={form.lastName} onChange={set("lastName")} placeholder="Last name" disabled={submitting} />
                  {fieldError("lastName")}
                </div>
                <div>
                  <label className={labelCls}>Date of Birth</label>
                  <input type="date" className={inputCls} value={form.dateOfBirth} onChange={set("dateOfBirth")} disabled={submitting} />
                  {fieldError("dateOfBirth")}
                </div>
                <div>
                  <label className={labelCls}>Gender</label>
                  <select className={selectCls} value={form.gender} onChange={set("gender")} disabled={submitting}>
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                  {fieldError("gender")}
                </div>
              </div>
            </div>

            {/* Medical */}
            <div>
              <h4 className="text-xs font-extrabold text-[var(--text)] mb-3 uppercase tracking-wider">Medical</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Blood Group</label>
                  <select className={selectCls} value={form.bloodGroup} onChange={set("bloodGroup")} disabled={submitting}>
                    <option value="">Select blood group</option>
                    {BLOOD_GROUP_OPTIONS.map((b) => (
                      <option key={b} value={b}>{b.replace("_", " ")}</option>
                    ))}
                  </select>
                  {fieldError("bloodGroup")}
                </div>
                <div>
                  <label className={labelCls}>Marital Status</label>
                  <select className={selectCls} value={form.maritalStatus} onChange={set("maritalStatus")} disabled={submitting}>
                    <option value="">Select status</option>
                    {MARITAL_STATUS_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  {fieldError("maritalStatus")}
                </div>
                <div>
                  <label className={labelCls}>National ID</label>
                  <input className={inputCls} value={form.nationalId} onChange={set("nationalId")} placeholder="National ID / NID" disabled={submitting} />
                  {fieldError("nationalId")}
                </div>
                <div>
                  <label className={labelCls}>Occupation</label>
                  <input className={inputCls} value={form.occupation} onChange={set("occupation")} placeholder="Occupation" disabled={submitting} />
                  {fieldError("occupation")}
                </div>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-xs font-extrabold text-[var(--text)] mb-3 uppercase tracking-wider">Contact Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls} value={form.phone} onChange={set("phone")} placeholder="+8801XXXXXXXXX" disabled={submitting} />
                  {fieldError("phone")}
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" className={inputCls} value={form.email} onChange={set("email")} placeholder="Email (optional)" disabled={submitting} />
                  {fieldError("email")}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Address</label>
                  <input className={inputCls} value={form.address} onChange={set("address")} placeholder="Street address" disabled={submitting} />
                  {fieldError("address")}
                </div>
                <div>
                  <label className={labelCls}>District</label>
                  <input className={inputCls} value={form.district} onChange={set("district")} placeholder="District" disabled={submitting} />
                  {fieldError("district")}
                </div>
                <div>
                  <label className={labelCls}>Photo URL</label>
                  <input className={inputCls} value={form.photo} onChange={set("photo")} placeholder="https://..." disabled={submitting} />
                  {fieldError("photo")}
                </div>
              </div>
            </div>

            {/* Contacts (create only) */}
            {mode === "create" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-extrabold text-[var(--text)] uppercase tracking-wider">Emergency Contacts</h4>
                  <button
                    type="button"
                    onClick={addContact}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:bg-[var(--primary-soft)]/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <FiPlus className="w-3.5 h-3.5" /> Add Contact
                  </button>
                </div>

                {contacts.length === 0 ? (
                  <p className="text-[11px] text-[var(--muted)]">No contacts added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {contacts.map((c, idx) => (
                      <div key={idx} className="border border-[var(--border)] rounded-xl p-4 space-y-3 bg-[var(--bg)]/40">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                            Contact #{idx + 1} {c.isPrimary && <span className="text-[var(--primary)]">• Primary</span>}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeContact(idx)}
                            disabled={submitting}
                            className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer"
                            aria-label="Remove contact"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Name *</label>
                            <input className={inputCls} value={c.name} onChange={(e) => updateContact(idx, "name", e.target.value)} placeholder="Contact name" disabled={submitting} />
                            {fieldError(`contacts.${idx}.name`)}
                          </div>
                          <div>
                            <label className={labelCls}>Relationship</label>
                            <input className={inputCls} value={c.relationship} onChange={(e) => updateContact(idx, "relationship", e.target.value)} placeholder="e.g. Spouse" disabled={submitting} />
                          </div>
                          <div>
                            <label className={labelCls}>Phone</label>
                            <input className={inputCls} value={c.phone} onChange={(e) => updateContact(idx, "phone", e.target.value)} placeholder="Phone" disabled={submitting} />
                            {fieldError(`contacts.${idx}.phone`)}
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelCls}>Address</label>
                            <input className={inputCls} value={c.address} onChange={(e) => updateContact(idx, "address", e.target.value)} placeholder="Address" disabled={submitting} />
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={c.isPrimary}
                            onChange={(e) => updateContact(idx, "isPrimary", e.target.checked)}
                            disabled={submitting}
                          />
                          Primary contact
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] shrink-0 bg-[var(--bg)]/40 rounded-b-3xl">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] rounded-xl text-xs font-bold transition-colors disabled:opacity-60 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-[var(--primary)]/20 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <FiSave className="w-3.5 h-3.5" />
              {submitting ? "Saving..." : mode === "create" ? "Create Patient" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}