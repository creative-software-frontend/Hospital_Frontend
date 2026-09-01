// app/patients/PatientProfileModal.tsx
// Full patient detail + emergency contacts CRUD. Actions that need
// confirmation (status change, delete) are delegated to the parent module.

"use client";

import { useEffect, useState } from "react";
import {
  FiX, FiUser, FiActivity, FiDroplet,
  FiTag, FiEdit2, FiTrash2, FiPlus, FiCheck, FiStar,
} from "react-icons/fi";
import {
  patientApi,
  contactApi,
  type PatientDetail,
  type PatientListRecord,
  type PatientContact,
  errorMessage,
  formatDate,
  calcAge,
} from "@/app/lib/api";
import {
  bloodGroupLabel, genderLabel, maritalStatusLabel,
} from "@/app/patients/constants";
import type { PatientCapabilities } from "@/app/lib/roles";
import type { ToastKind } from "@/app/patients/Toast";

interface ContactFormState {
  name: string;
  relationship: string;
  phone: string;
  address: string;
  isPrimary: boolean;
}

const EMPTY_CONTACT: ContactFormState = { name: "", relationship: "", phone: "", address: "", isPrimary: false };

const inputCls =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";
const labelCls = "block text-[11px] font-bold text-[var(--muted)] mb-1.5 uppercase tracking-wider";

export function PatientProfileModal({
  patient,
  caps,
  refreshToken,
  onClose,
  onRefreshNeeded,
  onRequestStatus,
  onRequestDelete,
  notify,
}: {
  patient: PatientListRecord;
  caps: PatientCapabilities;
  refreshToken: number;
  onClose: () => void;
  onRefreshNeeded: () => void;
  onRequestStatus: (patient: PatientListRecord) => void;
  onRequestDelete: (patient: PatientListRecord) => void;
  notify: (kind: ToastKind, message: string) => void;
}) {
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState<ContactFormState>(EMPTY_CONTACT);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await patientApi.get(patient.id);
        if (!cancelled) {
          setDetail(res.patient);
          setError("");
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patient, refreshToken]);

  const openContactForm = (contact?: PatientContact) => {
    setEditingContactId(contact?.id ?? null);
    setContactForm(
      contact
        ? {
            name: contact.name,
            relationship: contact.relationship ?? "",
            phone: contact.phone ?? "",
            address: contact.address ?? "",
            isPrimary: contact.isPrimary,
          }
        : EMPTY_CONTACT,
    );
    setContactError("");
    setContactFormOpen(true);
  };

  const closeContactForm = () => {
    setContactFormOpen(false);
    setEditingContactId(null);
    setContactForm(EMPTY_CONTACT);
    setContactError("");
  };

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim()) {
      setContactError("Contact name is required.");
      return;
    }
    setContactBusy(true);
    setContactError("");
    const payload = {
      name: contactForm.name.trim(),
      relationship: contactForm.relationship.trim() === "" ? undefined : contactForm.relationship.trim(),
      phone: contactForm.phone.trim() === "" ? undefined : contactForm.phone.trim(),
      address: contactForm.address.trim() === "" ? undefined : contactForm.address.trim(),
      isPrimary: contactForm.isPrimary,
    };
    try {
      if (editingContactId !== null) {
        await contactApi.update(patient.id, editingContactId, payload);
        notify("success", "Contact updated.");
      } else {
        await contactApi.create(patient.id, payload);
        notify("success", "Contact added.");
      }
      const res = await patientApi.get(patient.id);
      setDetail(res.patient);
      onRefreshNeeded();
      closeContactForm();
    } catch (err) {
      setContactError(errorMessage(err));
    } finally {
      setContactBusy(false);
    }
  };

  const removeContact = async (contact: PatientContact) => {
    if (!window.confirm(`Remove contact "${contact.name}"?`)) return;
    setContactBusy(true);
    try {
      await contactApi.remove(patient.id, contact.id);
      const res = await patientApi.get(patient.id);
      setDetail(res.patient);
      onRefreshNeeded();
      notify("success", "Contact removed.");
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setContactBusy(false);
    }
  };

  const p = detail;
  const contacts: PatientContact[] = p?.contacts ?? patient.contacts ?? [];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={onClose} />

      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[94vh] animate-[scaleIn_0.25s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] flex items-center justify-center shrink-0">
              <FiUser className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
                Patient Profile {p?.status === "inactive" && <span className="text-rose-500">• Inactive</span>}
              </span>
              <h3 className="font-black text-lg text-[var(--primary-dark)]">
                {p?.firstName ?? patient.firstName} {p?.lastName ?? patient.lastName}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {caps.edit && p && (
              <button
                onClick={() => onRequestStatus(patient)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  p.status === "active"
                    ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                    : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                }`}
                title={p.status === "active" ? "Deactivate patient" : "Activate patient"}
              >
                {p.status === "active" ? "Deactivate" : "Activate"}
              </button>
            )}
            {caps.delete && p && (
              <button
                onClick={() => onRequestDelete(patient)}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                title="Soft delete patient"
              >
                <FiTrash2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors"
              aria-label="Close"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto news-scroll">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs font-semibold text-rose-600">{error}</div>
            </div>
          ) : p ? (
            <div className="space-y-6 p-6">
              {/* Summary row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Summary value={p.patientCode} label="Patient Code" icon={<FiTag className="w-3.5 h-3.5" />} />
                <Summary
                  value={p.gender ? genderLabel(p.gender) : "—"}
                  label="Gender"
                  icon={<FiUser className="w-3.5 h-3.5" />}
                />
                <Summary value={calcAge(p.dateOfBirth)} label="Age" icon={<FiActivity className="w-3.5 h-3.5" />} />
                <Summary
                  value={p.bloodGroup ? bloodGroupLabel(p.bloodGroup) : "—"}
                  label="Blood Group"
                  icon={<FiDroplet className="w-3.5 h-3.5" />}
                />
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailBlock
                  title="Personal Information"
                  rows={[
                    ["Date of Birth", p.dateOfBirth ? formatDate(p.dateOfBirth) : "—"],
                    ["Marital Status", maritalStatusLabel(p.maritalStatus)],
                    ["National ID", p.nationalId ?? "—"],
                    ["Occupation", p.occupation ?? "—"],
                    ["Status", p.status === "active" ? "Active" : "Inactive"],
                  ]}
                />
                <DetailBlock
                  title="Contact Information"
                  rows={[
                    ["Phone", p.phone ?? "—"],
                    ["Email", p.email ?? "—"],
                    ["Address", p.address ?? "—"],
                    ["District", p.district ?? "—"],
                    ["Branch", `${p.branch?.name ?? ""} ${p.branch ? `(${p.branch.code})` : "(current)"}`],
                  ]}
                />
              </div>

              {/* Relations */}
              <div>
                <h4 className="text-xs font-extrabold text-[var(--text)] mb-3 uppercase tracking-wider">Linked Records</h4>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["Appointments", p._count.appointments],
                      ["Admissions", p._count.admissions],
                      ["Medical Records", p._count.medicalRecords],
                      ["Prescriptions", p._count.prescriptions],
                      ["Lab Orders", p._count.labOrders],
                      ["Invoices", p._count.invoices],
                      ["Payments", p._count.payments],
                    ] as const
                  ).map(([label, count]) => (
                    <span key={label} className="px-3 py-1.5 rounded-full bg-[var(--primary-soft)]/25 border border-[var(--primary)]/20 text-[11px] font-bold text-[var(--primary-dark)]">
                      {label}: {count}
                    </span>
                  ))}
                </div>
              </div>

              {/* Contacts */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-extrabold text-[var(--text)] uppercase tracking-wider">
                    Emergency Contacts
                  </h4>
                  {caps.manageContacts && (
                    <button
                      onClick={() => openContactForm()}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:bg-[var(--primary-soft)]/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <FiPlus className="w-3.5 h-3.5" /> Add Contact
                    </button>
                  )}
                </div>

                {contacts.length === 0 ? (
                  <p className="text-[11px] text-[var(--muted)]">No emergency contacts recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {contacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-3 border border-[var(--border)] rounded-xl px-4 py-3 bg-[var(--bg)]/40"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] flex items-center justify-center shrink-0">
                            <FiUser className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                              {c.name}
                              {c.isPrimary && <FiStar className="w-3 h-3 text-amber-400 shrink-0" />}
                            </p>
                            <p className="text-[10px] text-[var(--muted)] truncate">
                              {[c.relationship, c.phone, c.address].filter(Boolean).join(" • ") || "No details"}
                            </p>
                          </div>
                        </div>
                        {caps.manageContacts && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openContactForm(c)}
                              className="p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--primary-soft)]/20 hover:text-[var(--primary-dark)] transition-colors cursor-pointer"
                              title="Edit contact"
                            >
                              <FiEdit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeContact(c)}
                              className="p-2 rounded-lg text-[var(--muted)] hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer"
                              title="Remove contact"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {contactFormOpen && caps.manageContacts && (
                  <form
                    onSubmit={submitContact}
                    className="mt-4 border border-[var(--primary)]/30 rounded-xl p-4 space-y-3 bg-[var(--primary-soft)]/5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--primary-dark)]">
                        {editingContactId !== null ? "Edit Contact" : "New Contact"}
                      </span>
                      <button
                        type="button"
                        onClick={closeContactForm}
                        className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors cursor-pointer"
                      >
                        <FiX className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {contactError && (
                      <p className="text-[10px] font-bold text-rose-500">{contactError}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Name *</label>
                        <input
                          className={inputCls}
                          value={contactForm.name}
                          onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Contact name"
                          disabled={contactBusy}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Relationship</label>
                        <input
                          className={inputCls}
                          value={contactForm.relationship}
                          onChange={(e) => setContactForm((f) => ({ ...f, relationship: e.target.value }))}
                          placeholder="e.g. Spouse"
                          disabled={contactBusy}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Phone</label>
                        <input
                          className={inputCls}
                          value={contactForm.phone}
                          onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="Phone"
                          disabled={contactBusy}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Address</label>
                        <input
                          className={inputCls}
                          value={contactForm.address}
                          onChange={(e) => setContactForm((f) => ({ ...f, address: e.target.value }))}
                          placeholder="Address"
                          disabled={contactBusy}
                        />
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contactForm.isPrimary}
                        onChange={(e) => setContactForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                        disabled={contactBusy}
                      />
                      Primary contact
                    </label>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={contactBusy}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-60 cursor-pointer"
                      >
                        <FiCheck className="w-3.5 h-3.5" />
                        {contactBusy ? "Saving..." : editingContactId !== null ? "Save Changes" : "Add Contact"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Summary({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg)]/50 border border-[var(--border)] rounded-xl px-3 py-3">
      <div className="flex items-center gap-1.5 text-[var(--muted)]">
        {icon}
        <span className="text-[9px] uppercase font-extrabold tracking-widest">{label}</span>
      </div>
      <p className="text-sm font-black text-[var(--text)] mt-1 truncate">{value}</p>
    </div>
  );
}

function DetailBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="bg-[var(--bg)]/50 border border-[var(--border)] rounded-xl p-4">
      <h4 className="text-[11px] font-extrabold text-[var(--primary-dark)] uppercase tracking-wider mb-3">
        {title}
      </h4>
      <dl className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-xs">
            <dt className="text-[var(--muted)] font-semibold shrink-0">{k}</dt>
            <dd className="text-[var(--text)] font-bold text-right break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}