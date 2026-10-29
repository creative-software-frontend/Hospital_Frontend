// app/patients/EmergencyRegistrationPage.tsx
// "Emergency Patient Registration" sub-feature of the Patient Management module.
//
// Speed first: the form asks for four things only — who the patient is (a name,
// or an "Unknown …" label), sex, an approximate age and what happened. Priority
// defaults to Urgent and the arrival mode to Walk-in, and every optional
// demographic (phone, address, …) is deliberately absent: treatment starts now,
// the record is completed afterwards.
//
// The list underneath is the way that "afterwards" happens: today's arrivals
// that still miss a core demographic, each row opening the full patient form.

"use client";

import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiRefreshCcw,
  FiUser,
} from "react-icons/fi";
import {
  calcAge,
  emergencyApi,
  errorMessage,
  formatDate,
  patientApi,
  type DuplicateMatch,
  type EmergencyCaseRecord,
  type EmergencyPriority,
  type EmergencySummary,
  type PaginationMeta,
  type PatientDetail,
} from "@/app/lib/api";
import { genderLabel } from "@/app/patients/constants";
import { PatientFormModal } from "@/app/patients/PatientFormModal";

const PAGE_SIZE = 10;

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

const LABEL_CLS =
  "block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1";

const PRIORITY_BADGE: Record<EmergencyPriority, string> = {
  CRITICAL: "bg-rose-500/15 text-rose-600 border-rose-400/30",
  URGENT: "bg-amber-500/15 text-amber-600 border-amber-400/30",
  NON_URGENT: "bg-emerald-500/15 text-emerald-600 border-emerald-400/30",
};

const PRIORITY_LABEL: Record<EmergencyPriority, string> = {
  CRITICAL: "Critical",
  URGENT: "Urgent",
  NON_URGENT: "Non-urgent",
};

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

export function EmergencyRegistrationPage() {
  /* ---------------- quick intake (4 fields) ---------------- */
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [approxAge, setApproxAge] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [unidentified, setUnidentified] = useState(false);
  /** True while the name still mirrors the generated "Unknown …" label. */
  const [autoName, setAutoName] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; approxAge?: string }>({});
  const [registered, setRegistered] = useState<{
    caseNumber: string;
    patientCode: string;
    name: string;
    warnings: DuplicateMatch[];
  } | null>(null);

  /* ---------------- today's arrivals still missing details ---------------- */
  const [cases, setCases] = useState<EmergencyCaseRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [summary, setSummary] = useState<EmergencySummary | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [reload, setReload] = useState(0);

  const [completingId, setCompletingId] = useState<number | null>(null);
  const [editPatient, setEditPatient] = useState<PatientDetail | null>(null);

  // `incomplete: true` returns only patients still missing gender / DOB / phone
  // / address, while its summary still counts the whole day (so the header can
  // say "3 of 8" without a second request).
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      emergencyApi
        .list({ date: todayIso(), incomplete: true, page, limit: PAGE_SIZE })
        .then((res) => {
          if (!active) return;
          setCases(res.data);
          setPagination(res.pagination);
          setSummary(res.summary);
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
    setChiefComplaint("");
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

    // An unidentified patient still needs a name for the server, so the
    // generated label is used when the box is ticked and nothing was typed.
    const resolvedName = name.trim() || (unidentified ? suggestedUnknownName() : "");

    const errors: { name?: string; approxAge?: string } = {};
    if (!resolvedName) errors.name = "A name (or an \"Unknown …\" label) is required.";
    if (approxAge) {
      const age = Number(approxAge);
      if (!Number.isInteger(age) || age < 0 || age > 130) {
        errors.approxAge = "Enter an age between 0 and 130.";
      }
    }
    setFieldErrors(errors);
    if (errors.name || errors.approxAge) return;

    setSaving(true);
    setFormError("");
    setRegistered(null);

    emergencyApi
      .register({
        patient: {
          name: resolvedName,
          gender: gender ? (gender as "MALE" | "FEMALE" | "OTHER") : undefined,
          approxAge: approxAge ? Number(approxAge) : undefined,
        },
        // Not asked at the door: triage starts Urgent and can be raised later.
        priority: "URGENT",
        chiefComplaint: chiefComplaint.trim() || undefined,
        unidentified,
      })
      .then((res) => {
        setRegistered({
          caseNumber: res.emergencyCase.caseNumber,
          patientCode: res.emergencyCase.patient.patientCode,
          name: res.emergencyCase.patient.name,
          warnings: res.duplicateWarnings ?? [],
        });
        setPage(1);
        setReload((t) => t + 1);
        resetForm();
      })
      .catch((err) => setFormError(errorMessage(err)))
      .finally(() => setSaving(false));
  };

  const openComplete = (row: EmergencyCaseRecord) => {
    setCompletingId(row.patient.id);
    setQueueError("");
    patientApi
      .get(row.patient.id)
      .then((res) => setEditPatient(res.patient))
      .catch((err) => setQueueError(errorMessage(err)))
      .finally(() => setCompletingId(null));
  };

  const totalPages = pagination?.totalPages ?? 0;
  const today = todayIso();

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------------
          Fast intake — four fields, so care can start immediately
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
              Four fields, nothing more — finish the paperwork once the patient is stable.
            </p>
          </div>
        </div>

        {formError && <div className="alert-error text-xs">{formError}</div>}

        {registered && (
          <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 flex items-start gap-2">
            <FiCheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-black text-emerald-800">
                Registered {registered.caseNumber} · {registered.patientCode}
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
                // Fill the label the moment the box is ticked and nothing is typed.
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

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_9rem] gap-3">
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

          <div>
            <label htmlFor="er-complaint" className={LABEL_CLS}>
              Chief complaint
            </label>
            <textarea
              id="er-complaint"
              rows={2}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="What brought the patient in? e.g. chest pain since 30 minutes"
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10px] font-semibold text-[var(--muted)]">
              Priority defaults to Urgent. Phone, address and other details are completed later.
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
          Today's arrivals that still need their paperwork finished
      --------------------------------------------------------------- */}
      <div className="card p-6 rounded-2xl shadow-sm space-y-4 w-full">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)]">
              Today · {formatDate(`${today}T00:00:00`)}
            </p>
            <h4 className="font-black text-base text-[var(--text)]">Still needs details</h4>
            <p className="text-[11px] text-[var(--muted)] font-semibold">
              {summary
                ? summary.total === 0
                  ? "Waiting for today's first arrival."
                  : `${summary.needsInfo} of ${summary.total} arrivals today still need details.`
                : "Loading registrations…"}
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

        {loading && cases.length === 0 ? (
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
            <p className="text-xs font-bold text-[var(--muted)] mt-3">Loading registrations…</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
            <FiUser className="w-6 h-6 mx-auto mb-2 text-[var(--muted)] opacity-50" />
            <p className="text-xs font-bold text-[var(--muted)]">
              {summary && summary.total > 0
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
              {cases.map((row) => (
                <div
                  key={row.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 flex-wrap hover:bg-[var(--primary-soft)]/10 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-16 shrink-0">
                      <span className="flex items-center gap-1 text-[11px] font-black text-[var(--text)]">
                        <FiClock className="w-3 h-3 text-[var(--muted)]" />
                        {timeOf(row.arrivedAt)}
                      </span>
                      <span className="block text-[9px] font-bold text-[var(--muted)]">
                        {row.caseNumber}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-[var(--text)]">
                          {row.patient.name}
                        </span>
                        <span className="text-[10px] font-semibold text-[var(--muted)]">
                          {row.patient.patientCode}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${PRIORITY_BADGE[row.priority]}`}
                        >
                          {PRIORITY_LABEL[row.priority]}
                        </span>
                        {row.unidentified && (
                          <span className="text-[9px] font-bold uppercase tracking-wide border border-[var(--border)] rounded-full px-2 py-0.5 text-[var(--muted)]">
                            Unidentified
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-semibold text-[var(--muted)] mt-0.5">
                        {[
                          genderLabel(row.patient.gender),
                          row.patient.dateOfBirth
                            ? `${calcAge(row.patient.dateOfBirth)} yrs`
                            : null,
                          row.patient.phone,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No demographics recorded yet"}
                      </p>
                      {row.chiefComplaint && (
                        <p className="text-[10px] text-[var(--muted)] mt-0.5 line-clamp-2">
                          {row.chiefComplaint}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                    <span className="inline-flex flex-wrap gap-1 justify-end">
                      {row.patient.missing.map((field) => (
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
                      disabled={completingId === row.patient.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[10px] font-bold text-[var(--muted)] hover:text-[var(--text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <FiEdit3 className="w-3 h-3" />
                      {completingId === row.patient.id ? "Opening…" : "Complete info"}
                    </button>
                  </div>
                </div>
              ))}
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
