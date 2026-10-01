// app/patients/PatientFormModal.tsx
// Create / edit patient modal. Mirrors the backend create/update validation
// schemas and surfaces field-level errors returned by the API.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  BusinessRuleError,
  errorMessage,
} from "@/app/lib/api";
import {
  GENDER_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  OCCUPATION_OPTIONS,
} from "@/app/patients/constants";
import { useMasterDataOptions } from "@/app/lib/useMasterData";
import { useAddressCascade } from "@/app/lib/useAddressCascade";
import {
  ADDRESS_MAX,
  addError,
  checkDateOfBirth,
  checkEmail,
  checkName,
  checkPhone,
  checkText,
  MAX_CONTACTS,
  NATIONAL_ID_MAX,
  SHORT_TEXT_MAX,
} from "@/app/lib/formValidation";
import type { Occupation } from "@/app/lib/api";

interface ContactDraft {
  name: string;
  relationship: string;
  phone: string;
  address: string;
  isPrimary: boolean;
}

interface FormState {
  name: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  maritalStatus: string;
  phone: string;
  email: string;
  whatsapp: string;
  address: string;
  division: string;
  district: string;
  upazila: string;
  thana: string;
  nationalId: string;
  occupation: string;
  photo: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  dateOfBirth: "",
  gender: "",
  bloodGroup: "",
  maritalStatus: "",
  phone: "",
  email: "",
  whatsapp: "",
  address: "",
  division: "",
  district: "",
  upazila: "",
  thana: "",
  nationalId: "",
  occupation: "",
  photo: "",
};

function prefillFromPatient(p: PatientDetail | PatientListRecord | null): FormState {
  if (!p) return EMPTY_FORM;
  return {
    name: p.name ?? "",
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : "",
    gender: p.gender ?? "",
    bloodGroup: p.bloodGroup ?? "",
    maritalStatus: p.maritalStatus ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    whatsapp: p.whatsapp ?? "",
    address: p.address ?? "",
    division: p.division ?? "",
    district: p.district ?? "",
    upazila: p.upazila ?? "",
    thana: p.thana ?? "",
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
  onSaved: (patientCode?: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() => prefillFromPatient(patient));
  const [contacts, setContacts] = useState<ContactDraft[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Master Data is authoritative for these lists; the hardcoded constants are
  // only a fallback for when the category has not been configured yet.
  const { options: masterBloodGroups } = useMasterDataOptions("blood_groups", BLOOD_GROUP_OPTIONS);

  const {
    divisions,
    districts,
    localities,
    divisionsLoading,
    districtsLoading,
    localitiesLoading,
    addressError,
    retryAddress,
    loadDistricts,
    loadLocalities,
    resetDistricts,
    resetLocalities,
  } = useAddressCascade();

  // The dataset has no separate metropolitan thanas, so the locality level is
  // the upazila list and it also serves as the thana.
  const upazilas = useMemo(() => localities, [localities]);

  // A stored value must stay visible even if it was later removed from master
  // data, otherwise editing this patient would silently blank their blood group.
  const bloodGroups = useMemo(() => {
    const current = form.bloodGroup;
    if (!current || masterBloodGroups.some((b) => b.value === current)) return masterBloodGroups;
    return [...masterBloodGroups, { code: current, label: current.replace("_", " "), value: current, sortOrder: 999, fallback: true }];
  }, [masterBloodGroups, form.bloodGroup]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFieldErrors((prev) => ({ ...prev, [key]: "" }));
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const clearFieldError = (key: string) =>
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));

  // Changing a level invalidates everything below it, so the stored children are
  // dropped and their option lists are reloaded or cleared.
  const onDivisionChange = (label: string) => {
    clearFieldError("division");
    resetDistricts();
    resetLocalities();
    setForm((prev) => ({ ...prev, division: label, district: "", upazila: "", thana: "" }));
    const code = divisions.find((d) => d.label === label)?.code;
    if (code) loadDistricts(code);
  };

  const onDistrictChange = (label: string) => {
    clearFieldError("district");
    resetLocalities();
    setForm((prev) => ({ ...prev, district: label, upazila: "", thana: "" }));
    const code = districts.find((d) => d.label === label)?.code;
    if (code) loadLocalities(code);
  };

  // The chosen locality always lands in `upazila`; `thana` is cleared because the
  // dataset has no thana of its own any more.
  const onLocalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    clearFieldError("upazila");
    const label = e.target.value;
    setForm((prev) => ({ ...prev, upazila: label, thana: "" }));
  };

  // An existing record stores labels, so the child lists have to be fetched
  // before the saved district/locality can be shown as selected.
  const prefillDone = useRef(false);
  useEffect(() => {
    if (prefillDone.current || divisionsLoading) return;
    const savedDivision = form.division;
    if (!savedDivision) {
      prefillDone.current = true;
      return;
    }
    const divisionCode = divisions.find((d) => d.label === savedDivision)?.code;
    if (!divisionCode) {
      prefillDone.current = true;
      return;
    }
    prefillDone.current = true;

    loadDistricts(divisionCode);
    const savedDistrict = form.district;
    if (!savedDistrict) return;
    const districtCode = districts.find((d) => d.label === savedDistrict)?.code;
    // districts is still empty on this pass, so resolve the code once it lands.
    if (districtCode) loadLocalities(districtCode);
  }, [divisions, divisionsLoading, loadDistricts, loadLocalities, form.division, form.district]);

  useEffect(() => {
    if (!form.district || districts.length === 0 || localities.length > 0) return;
    const code = districts.find((d) => d.label === form.district)?.code;
    if (code) loadLocalities(code);
  }, [form.district, districts, localities.length, loadLocalities]);

  const updateContact = (idx: number, key: keyof ContactDraft, value: string | boolean) => {
    setContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, [key]: value } : c)));
    if (typeof value === "string") clearFieldError(`contacts.${idx}.${key}`);
  };

  const addContact = () =>
    setContacts((prev) => [
      ...prev,
      { name: "", relationship: "", phone: "", address: "", isPrimary: prev.length === 0 },
    ]);

  // Rows shift when one is removed, so the remaining per-row errors have to be
  // re-indexed or they end up attached to the wrong contact.
  const removeContact = (idx: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== idx));
    setFieldErrors((prev) => {
      const next: Record<string, string> = {};
      for (const [key, message] of Object.entries(prev)) {
        if (key === "contacts") {
          next.contacts = message;
          continue;
        }
        const match = /^contacts\.(\d+)\.(.+)$/.exec(key);
        if (!match) {
          next[key] = message;
          continue;
        }
        const row = Number(match[1]);
        if (row < idx) next[key] = message;
        else if (row === idx) continue;
        else next[`contacts.${row - 1}.${match[2]}`] = message;
      }
      return next;
    });
  };

  const buildInput = (): CreatePatientInput => {
    const opt = (v: string): string | undefined => (v.trim() === "" ? undefined : v.trim());
    const hasGender = GENDER_OPTIONS.some((g) => g.value === form.gender);
    const hasBlood = (BLOOD_GROUP_OPTIONS as string[]).includes(form.bloodGroup);
    const hasMarital = MARITAL_STATUS_OPTIONS.some((m) => m.value === form.maritalStatus);
    const hasOccupation = OCCUPATION_OPTIONS.some((o) => o.value === form.occupation);
    return {
      name: form.name.trim(),
      dateOfBirth: opt(form.dateOfBirth),
      gender: hasGender ? (form.gender as Gender) : undefined,
      bloodGroup: hasBlood ? (form.bloodGroup as BloodGroup) : undefined,
      maritalStatus: hasMarital ? (form.maritalStatus as MaritalStatus) : undefined,
      phone: opt(form.phone),
      email: opt(form.email),
      whatsapp: opt(form.whatsapp),
      address: opt(form.address),
      division: opt(form.division),
      district: opt(form.district),
      upazila: opt(form.upazila),
      thana: opt(form.thana),
      nationalId: opt(form.nationalId),
      occupation: hasOccupation ? (form.occupation as Occupation) : undefined,
      photo: opt(form.photo),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Mirrors the backend Zod rules so an obviously bad value is caught before
    // a round trip. The server still has the final say, and its per-field
    // messages are merged into the same fieldErrors map below.
    const local: Record<string, string> = {};
    addError(local, "name", checkName(form.name));
    addError(local, "email", checkEmail(form.email));
    addError(local, "phone", checkPhone(form.phone));
    addError(local, "whatsapp", checkPhone(form.whatsapp));
    addError(local, "dateOfBirth", checkDateOfBirth(form.dateOfBirth));
    addError(local, "address", checkText(form.address, ADDRESS_MAX, "Address"));
    addError(local, "nationalId", checkText(form.nationalId, NATIONAL_ID_MAX, "National ID"));

    // A district or lower level without a division would be orphaned data, so
    // the cascade has to be consistent top down. `thana` is checked too because a
    // record saved before the upazila level took over can still hold one.
    for (const [child, parent, label] of [
      ["district", "division", "Division"],
      ["upazila", "district", "District"],
      ["thana", "district", "District"],
    ] as const) {
      if (form[child].trim() && !form[parent].trim()) {
        addError(local, parent, `${label} is required to select ${child}.`);
      }
    }

    // Emergency contacts were previously sent unchecked, so a typo in a
    // relative's phone number only surfaced as a server error.
    if (contacts.length > MAX_CONTACTS) {
      local.contacts = `A patient can have at most ${MAX_CONTACTS} contacts.`;
    }
    contacts.forEach((c, i) => {
      if (!c.name.trim()) return;
      addError(local, `contacts.${i}.name`, checkName(c.name));
      addError(local, `contacts.${i}.phone`, checkPhone(c.phone));
      addError(local, `contacts.${i}.relationship`, checkText(c.relationship, SHORT_TEXT_MAX, "Relationship"));
      addError(local, `contacts.${i}.address`, checkText(c.address, ADDRESS_MAX, "Address"));
    });

    if (Object.keys(local).length > 0) {
      setFieldErrors(local);
      setFormError("Please correct the highlighted fields.");
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
        const created = await patientApi.create(mappedContacts.length > 0 ? { ...input, contacts: mappedContacts } : input);
        onSaved(created.patient.patientCode);
      } else if (patient) {
        await patientApi.update(patient.id, input);
        onSaved(patient.patientCode);
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        setFieldErrors(err.fieldErrors ?? {});
        setFormError(err.message);
      } else if (err instanceof BusinessRuleError) {
        // Branch-configured required channels (phone / whatsapp / email) report
        // the field they rejected.
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
                <div className="sm:col-span-2">
                  <label className={labelCls}>Name *</label>
                  <input className={inputCls} value={form.name} onChange={set("name")} placeholder="Full name" disabled={submitting} />
                  {fieldError("name")}
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
                    {bloodGroups.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
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
                  <select className={selectCls} value={form.occupation} onChange={set("occupation")} disabled={submitting}>
                    <option value="">Select occupation</option>
                    {OCCUPATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
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
                <div>
                  <label className={labelCls}>WhatsApp</label>
                  <input className={inputCls} value={form.whatsapp} onChange={set("whatsapp")} placeholder="+8801XXXXXXXXX" disabled={submitting} />
                  {fieldError("whatsapp")}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Address (street / house)</label>
                  <input className={inputCls} value={form.address} onChange={set("address")} placeholder="House 5, Road 2, Block C" disabled={submitting} />
                  {fieldError("address")}
                </div>

                {/* Bangladesh administrative cascade. Each level is populated
                    from Master Data and only enabled once its parent is chosen,
                    so the selection is always a real chain. */}
                {addressError && (
                  <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
                    <span>Address list unavailable: {addressError}</span>
                    <button
                      type="button"
                      onClick={retryAddress}
                      className="shrink-0 rounded-lg border border-red-300 bg-white px-2.5 py-1 font-bold hover:bg-red-100"
                    >
                      Retry
                    </button>
                  </div>
                )}
                <div>
                  <label className={labelCls}>Division</label>
                  <select
                    className={selectCls}
                    value={form.division}
                    onChange={(e) => onDivisionChange(e.target.value)}
                    disabled={submitting || divisionsLoading}
                  >
                    <option value="">
                      {divisionsLoading
                        ? "Loading divisions..."
                        : divisions.length === 0
                          ? "No divisions available"
                          : "Select division"}
                    </option>
                    {divisions.map((d) => (
                      <option key={d.code} value={d.label}>{d.label}</option>
                    ))}
                  </select>
                  {fieldError("division")}
                </div>

                <div>
                  <label className={labelCls}>District</label>
                  <select
                    className={selectCls}
                    value={form.district}
                    onChange={(e) => onDistrictChange(e.target.value)}
                    disabled={submitting || !form.division || districtsLoading}
                  >
                    <option value="">
                      {!form.division
                        ? "Select division first"
                        : districtsLoading
                          ? "Loading districts..."
                          : districts.length === 0
                            ? "No districts available"
                            : "Select district"}
                    </option>
                    {districts.map((d) => (
                      <option key={d.code} value={d.label}>{d.label}</option>
                    ))}
                  </select>
                  {fieldError("district")}
                </div>

                <div>
                  <label className={labelCls}>Upazila</label>
                  <select
                    className={selectCls}
                    value={form.upazila}
                    onChange={onLocalityChange}
                    disabled={submitting || !form.district || localitiesLoading}
                  >
                    <option value="">
                      {!form.district
                        ? "Select district first"
                        : localitiesLoading
                          ? "Loading..."
                          : localities.length === 0
                            ? "None for this district"
                            : "Select upazila"}
                    </option>
                    {upazilas.map((u) => (
                      <option key={u.code} value={u.label}>
                        {u.label}
                        {u.bnName ? ` (${u.bnName})` : ""}
                      </option>
                    ))}
                  </select>
                  {fieldError("upazila")}
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
                            {fieldError(`contacts.${idx}.relationship`)}
                          </div>
                          <div>
                            <label className={labelCls}>Phone</label>
                            <input className={inputCls} value={c.phone} onChange={(e) => updateContact(idx, "phone", e.target.value)} placeholder="Phone" disabled={submitting} />
                            {fieldError(`contacts.${idx}.phone`)}
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelCls}>Address</label>
                            <input className={inputCls} value={c.address} onChange={(e) => updateContact(idx, "address", e.target.value)} placeholder="Address" disabled={submitting} />
                            {fieldError(`contacts.${idx}.address`)}
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