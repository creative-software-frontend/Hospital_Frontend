// app/patients/EmergencyRegistrationPage.tsx
// "Emergency Patient Registration" sub-feature of the Patient Management module.
//
// Speed first: the form asks for a name (or an "Unknown …" label), sex and an
// approximate age. Everything else — phone, address, date of birth — is
// completed afterwards from the patient record. Emergency patients are ordinary
// Patient rows with `patientType = "EMERGENCY`; the separate triage-case table
// was removed so nothing is split across two tables.

"use client";

import { useEffect, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiClock, FiEdit3, FiRefreshCcw, FiUser } from "react-icons/fi";
import {
  calcAge,
  errorMessage,
  formatDate,
  patientApi,
  type DuplicateMatch,
  type PatientListRecord,
  type PatientDetail,
} from "@/app/lib/api";
import { RELATIONSHIP_OPTIONS, genderLabel } from "@/app/patients/constants";
import { PatientFormModal } from "@/app/patients/PatientFormModal";
import { useMasterDataOptions } from "@/app/lib/useMasterData";
import { addError, checkName, checkPhone } from "@/app/lib/formValidation";

const PAGE_SIZE = 10;

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

const LABEL_CLS =
  "block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1";

function timeOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** `YYYY-MM-DD` for the local day (matches the API's local-midnight range). */
function todayIso(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Placeholder identity for someone who cannot tell us who they are. */
function unknownName(gender: string, age: string): string {
  const who = gender === "MALE" ? "Male" : gender === "FEMALE" ? "Female" : "Patient";
  return age ? `Unknown ${who} ~${age}` : `Unknown ${who}`;
}

/** Which core demographics a patient is still missing. */
function missingFields(p: PatientListRecord): string[] {
  const missing: string[] = [];
  if (!p.gender) missing.push("Gender");
  if (!p.dateOfBirth) missing.push("Date of birth");
  if (!p.phone) missing.push("Phone");
  if (!p.address) missing.push("Address");
  return missing;
}

export function EmergencyRegistrationPage() {
  const { options: relationshipOptions, loading: relationshipsLoading } =
    useMasterDataOptions("relationships");
  const availableRelationshipOptions =
    relationshipOptions.length > 0
      ? relationshipOptions
      : RELATIONSHIP_OPTIONS.map((relationship, index) => ({
          value: relationship.value,
          label: relationship.label,
          code: relationship.value,
          sortOrder: index,
          fallback: true,
        }));

  /* ---------------- quick intake ---------------- */
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [approxAge, setApproxAge] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [unidentified, setUnidentified] = useState(false);
  /** True while the name still mirrors the generated "Unknown …" label. */
  const [autoName, setAutoName] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [registered, setRegistered] = useState<{
    patientCode: string;
    name: string;
    warnings: DuplicateMatch[];
  } | null>(null);

  /* ---------------- today's arrivals still missing details ---------------- */
  const [patients, setPatients] = useState<PatientListRecord[]>([]);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [reload, setReload] = useState(0);

  const [completingId, setCompletingId] = useState<number | null>(null);
  const [editPatient, setEditPatient] = useState<PatientDetail | null>(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const today = todayIso();
      patientApi
        .list({
          patientType: "EMERGENCY",
          createdFrom: today,
          createdTo: today,
          page,
          limit: PAGE_SIZE,
        })
        .then((res) => {
          if (!active) return;
          setPatients(res.data);
          setPagination(res.pagination);
          setQueueError("");
        })
        .catch((err) => {
          if (active) setQueueError(errorMessage(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page, reload]);

  const suggestedUnknownName = () => unknownName(gender, approxAge);

  const resetForm = () => {
    setName("");
    setGender("");
    setApproxAge("");
    setGuardianName("");
    setGuardianRelationship("");
    setGuardianPhone("");
    setUnidentified(false);
    setAutoName(false);
    setFieldErrors({});
  };

  /** While the box stays ticked, sex/age edits rewrite the placeholder label. */
  const syncAutoName = (nextGender: string, nextAge: string) => {
    if (unidentified && autoName) setName(unknownName(nextGender, nextAge));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const resolvedName = name.trim() || (unidentified ? suggestedUnknownName() : "");

    const errors: Record<string, string> = {};
    if (!resolvedName) errors.name = "A name (or an \"Unknown …\" label) is required.";
    if (approxAge) {
      const age = Number(approxAge);
      if (!Number.isInteger(age) || age < 0 || age > 130) {
        errors.approxAge = "Enter an age between 0 and 130.";
      }
    }
    addError(errors, "guardianName", checkName(guardianName));
    addError(errors, "guardianPhone", checkPhone(guardianPhone));
    if (guardianName.trim() && !guardianRelationship) {
      errors.guardianRelationship = "Select a relationship.";
    }
    if (guardianName.trim() && !guardianPhone.trim()) {
      errors.guardianPhone = "A guardian contact number is required.";
    }
    if (guardianPhone.trim() && !guardianName.trim()) {
      errors.guardianName = "Enter the guardian name.";
    }
    if (guardianRelationship && !guardianName.trim()) {
      errors.guardianName = "Enter the guardian name.";
    }
    setFieldErrors(errors);
    if (errors.name || errors.approxAge) return;

    setSaving(true);
    setFormError("");
    setRegistered(null);

    const dateOfBirth = approxAge ? new Date(new Date().getFullYear() - Number(approxAge), 0, 1).toISOString() : undefined;

    const contacts = guardianName.trim()
      ? [{
          name: guardianName.trim(),
          relationship: guardianRelationship || undefined,
          phone: guardianPhone.trim() || undefined,
          isPrimary: true,
        }]
      : undefined;

    patientApi
      .create({
        name: resolvedName,
        ...(gender ? { gender: gender as "MALE" | "FEMALE" | "OTHER" } : {}),
        ...(dateOfBirth ? { dateOfBirth } : {}),
        patientType: "EMERGENCY",
        forEmergency: true,
        contacts,
      })
      .then((res) => {
        setRegistered({
          patientCode: res.patient.patientCode,
          name: res.patient.name,
          warnings: res.patient.duplicateWarnings ?? [],
        });
        setPage(1);
        setReload((t) => t + 1);
        resetForm();
      })
      .catch((err) => setFormError(errorMessage(err)))
      .finally(() => setSaving(false));
  };

  const openComplete = (row: PatientListRecord) => {
    setCompletingId(row.id);
    setQueueError("");
    patientApi
      .get(row.id)
      .then((res) => setEditPatient(res.patient))
      .catch((err) => setQueueError(errorMessage(err)))
      .finally(() => setCompletingId(null));
  };

  const totalPages = pagination?.totalPages ?? 0;
  const today = todayIso();
  const incompleteCount = patients.filter((p) => missingFields(p).length > 0).length;

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------------
          Fast intake — minimal fields, so care can start immediately
      --------------------------------------------------------------- */}
      <div className="card p-6 rounded-2xl shadow-sm space-y-4 w-full">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
            <FiAlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)]">
              Emergency desk
            </p>
            <h4 className="font-black text-lg text-[var(--text)] leading-tight">
              Emergency Patient Registration
            </h4>
            <p className="text-[11px] text-[var(--muted)] font-semibold">
              Capture the essentials now; finish the paperwork once the patient is stable.
            </p>
          </div>
        </div>

        {formError && <div className="alert-error text-xs">{formError}</div>}

        {registered && (
          <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 flex items-start gap-2">
            <FiCheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-black text-emerald-800">
                Registered {registered.patientCode}
              </p>
              <p className="text-[11px] font-semibold text-emerald-700">
                {registered.name} is on today&apos;s board. Add the missing details from the list
                below whenever they are known.
              </p>
              {registered.warnings.length > 0 && (
                <p className="text-[11px] font-semibold text-amber-700 mt-1">
                  Possible duplicate:{" "}
                  {registered.warnings.map((w) => `${w.name} (${w.patientCode})`).join(", ")}
                </p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={unidentified}
              onChange={(e) => {
                const next = e.target.checked;
                setUnidentified(next);
                if (next && !name.trim()) {
                  setName(suggestedUnknownName());
                  setAutoName(true);
                } else if (!next) {
                  setAutoName(false);
                }
                setFieldErrors((p) => ({ ...p, name: "" }));
              }}
              className="mt-0.5 w-3.5 h-3.5 accent-[var(--primary)] cursor-pointer"
            />
            <span>
              <span className="block text-[11px] font-bold text-[var(--text)]">
                Unidentified / unconscious patient
              </span>
              <span className="block text-[10px] font-semibold text-[var(--muted)]">
                Registers a temporary label such as &quot;{suggestedUnknownName()}&quot; that the real
                name replaces later.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,16rem)_8rem_9rem] gap-3">
            <div>
              <label htmlFor="er-name" className={LABEL_CLS}>
                Patient name *
              </label>
              <input
                id="er-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setAutoName(false);
                  setFieldErrors((p) => ({ ...p, name: "" }));
                }}
                placeholder={unidentified ? suggestedUnknownName() : "Name as known"}
                className={INPUT_CLS}
              />
              {fieldErrors.name && (
                <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="er-gender" className={LABEL_CLS}>
                Sex
              </label>
              <select
                id="er-gender"
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value);
                  syncAutoName(e.target.value, approxAge);
                }}
                className={INPUT_CLS}
              >
                <option value="">Not known</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="er-age" className={LABEL_CLS}>
                Approx. age
              </label>
              <input
                id="er-age"
                type="number"
                min={0}
                max={130}
                value={approxAge}
                onChange={(e) => {
                  setApproxAge(e.target.value);
                  syncAutoName(gender, e.target.value);
                  setFieldErrors((p) => ({ ...p, approxAge: "" }));
                }}
                placeholder="Years"
                className={INPUT_CLS}
              />
              {fieldErrors.approxAge && (
                <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.approxAge}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 space-y-3">
            <div>
              <p className="text-[11px] font-black text-[var(--text)]">Guardian contact</p>
              <p className="text-[10px] font-semibold text-[var(--muted)]">
                Add a reachable family member or guardian if known.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,16rem)_11rem_minmax(0,14rem)] gap-3">
              <div>
                <label htmlFor="er-guardian-name" className={LABEL_CLS}>Guardian name</label>
                <input
                  id="er-guardian-name"
                  type="text"
                  value={guardianName}
                  onChange={(e) => {
                    setGuardianName(e.target.value);
                    setFieldErrors((p) => ({ ...p, guardianName: "", guardianPhone: "" }));
                  }}
                  placeholder="Name"
                  className={INPUT_CLS}
                />
                {fieldErrors.guardianName && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.guardianName}</p>
                )}
              </div>
              <div>
                <label htmlFor="er-guardian-relationship" className={LABEL_CLS}>Relationship</label>
                <select
                  id="er-guardian-relationship"
                  value={guardianRelationship}
                  onChange={(e) => {
                    setGuardianRelationship(e.target.value);
                    setFieldErrors((p) => ({ ...p, guardianRelationship: "" }));
                  }}
                  className={INPUT_CLS}
                >
                  <option value="">
                    {relationshipsLoading ? "Loading..." : "Select relation"}
                  </option>
                  {availableRelationshipOptions.map((relationship) => (
                    <option key={relationship.value} value={relationship.value}>
                      {relationship.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.guardianRelationship && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.guardianRelationship}</p>
                )}
              </div>
              <div>
                <label htmlFor="er-guardian-phone" className={LABEL_CLS}>Contact number</label>
                <input
                  id="er-guardian-phone"
                  type="tel"
                  value={guardianPhone}
                  onChange={(e) => {
                    setGuardianPhone(e.target.value);
                    setFieldErrors((p) => ({ ...p, guardianPhone: "", guardianName: "" }));
                  }}
                  placeholder="Phone number"
                  className={INPUT_CLS}
                />
                {fieldErrors.guardianPhone && (
                  <p className="text-[10px] font-bold text-rose-500 mt-1">{fieldErrors.guardianPhone}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10px] font-semibold text-[var(--muted)]">
              Address and other details can be completed later from the list below.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <FiAlertCircle className="w-3.5 h-3.5" />
              {saving ? "Registering…" : "Register emergency patient"}
            </button>
          </div>
        </form>
      </div>

      {/* ---------------------------------------------------------------
          Today's emergency arrivals that still need their paperwork finished
      --------------------------------------------------------------- */}
      <div className="card p-6 rounded-2xl shadow-sm space-y-4 w-full">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)]">
              Today · {formatDate(`${today}T00:00:00`)}
            </p>
            <h4 className="font-black text-base text-[var(--text)]">Still needs details</h4>
            <p className="text-[11px] text-[var(--muted)] font-semibold">
              {pagination?.total === 0
                ? "Waiting for today's first arrival."
                : `${incompleteCount} of ${pagination?.total ?? 0} emergency arrivals still need details.`}
            </p>
          </div>
          <button
            onClick={() => setReload((t) => t + 1)}
            title="Refresh list"
            className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            <FiRefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {queueError && (
          <div className="alert-error text-xs flex items-center justify-between">
            {queueError}
            <button
              onClick={() => setReload((t) => t + 1)}
              className="text-xs font-bold underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loading && patients.length === 0 ? (
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
            <p className="text-xs font-bold text-[var(--muted)] mt-3">Loading registrations…</p>
          </div>
        ) : patients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
            <FiUser className="w-6 h-6 mx-auto mb-2 text-[var(--muted)] opacity-50" />
            <p className="text-xs font-bold text-[var(--muted)]">
              {pagination && pagination.total > 0
                ? "Every emergency patient today has complete details."
                : "No emergency registrations yet today."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-[var(--bg)] border-b border-[var(--border)] text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)]">
              <span className="w-16 shrink-0">Time</span>
              <span className="flex-1">Patient</span>
              <span className="flex-1">Missing</span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {patients.map((row) => {
                const miss = missingFields(row);
                return (
                  <div
                    key={row.id}
                    className="flex items-start justify-between gap-3 px-4 py-3 flex-wrap hover:bg-[var(--primary-soft)]/10 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-16 shrink-0">
                        <span className="flex items-center gap-1 text-[11px] font-black text-[var(--text)]">
                          <FiClock className="w-3 h-3 text-[var(--muted)]" />
                          {timeOf(row.createdAt)}
                        </span>
                        <span className="block text-[9px] font-bold text-[var(--muted)]">
                          {row.patientCode}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-[var(--text)]">
                            {row.name}
                          </span>
                        </div>
                        <p className="text-[10px] font-semibold text-[var(--muted)] mt-0.5">
                          {[
                            genderLabel(row.gender),
                            row.dateOfBirth ? `${calcAge(row.dateOfBirth)} yrs` : null,
                            row.phone,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No demographics recorded yet"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                      <span className="inline-flex flex-wrap gap-1 justify-end">
                        {miss.map((field) => (
                          <span
                            key={field}
                            className="text-[9px] font-bold text-amber-700 bg-amber-500/10 border border-amber-400/30 rounded-full px-1.5 py-0.5"
                          >
                            {field}
                          </span>
                        ))}
                      </span>
                      <button
                        onClick={() => openComplete(row)}
                        disabled={completingId === row.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[10px] font-bold text-[var(--muted)] hover:text-[var(--text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <FiEdit3 className="w-3 h-3" />
                        {completingId === row.id ? "Opening…" : "Complete info"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] font-bold text-[var(--muted)]">
              Page {pagination?.page} of {totalPages} · {pagination?.total} waiting
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {editPatient && (
        <PatientFormModal
          mode="edit"
          patient={editPatient}
          onClose={() => setEditPatient(null)}
          onSaved={() => {
            setEditPatient(null);
            setReload((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}
