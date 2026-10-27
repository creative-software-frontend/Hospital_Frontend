// app/patients/PatientProfilePage.tsx
// "Patient Profile Management" sub-feature of the Patient Management module.
// Pick a patient with the search box, then view / edit their complete profile
// (demographics, address, medical, linked records, emergency contacts) inline.

"use client";

import { useState } from "react";
import {
  patientApi,
  type PatientListRecord,
  type PatientStatus,
  errorMessage,
} from "@/app/lib/api";
import type { PatientCapabilities } from "@/app/lib/roles";
import { PatientProfileModal } from "@/app/patients/PatientProfileModal";
import { PatientFormModal } from "@/app/patients/PatientFormModal";
import { PatientSearchPicker } from "@/app/patients/PatientSearchPicker";
import { ConfirmDialog } from "@/app/patients/ConfirmDialog";
import type { ToastKind } from "@/app/patients/Toast";

type ConfirmState = { kind: "delete" | "status"; patient: PatientListRecord };

export function PatientProfilePage({
  caps,
  notify,
  onChanged,
}: {
  caps: PatientCapabilities;
  notify: (kind: ToastKind, message: string) => void;
  /** Called when a patient was edited / deleted so the list can refresh. */
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<PatientListRecord | null>(null);
  const [profileToken, setProfileToken] = useState(0);
  const [editing, setEditing] = useState<PatientListRecord | null>(null);

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirming, setConfirming] = useState(false);

  const refreshResults = () => setProfileToken((t) => t + 1);

  const pick = (patient: PatientListRecord) => {
    setSelected(patient);
    setProfileToken((t) => t + 1);
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try {
      if (confirm.kind === "delete") {
        await patientApi.remove(confirm.patient.id);
        notify("success", `Patient ${confirm.patient.patientCode} deleted.`);
        if (selected?.id === confirm.patient.id) setSelected(null);
      } else {
        const next: PatientStatus = confirm.patient.status === "active" ? "inactive" : "active";
        await patientApi.updateStatus(confirm.patient.id, next);
        notify("success", `Patient ${confirm.patient.patientCode} marked ${next}.`);
      }
      setConfirm(null);
      setConfirming(false);
      onChanged();
      refreshResults();
    } catch (err) {
      notify("error", errorMessage(err));
      setConfirm(null);
      setConfirming(false);
    }
  };

  const confirmLabel = !confirm
    ? ""
    : confirm.kind === "delete"
      ? "Delete Patient"
      : confirm.patient.status === "active"
        ? "Deactivate Patient"
        : "Activate Patient";

  const confirmMessage = !confirm
    ? ""
    : confirm.kind === "delete"
      ? `Patient "${confirm.patient.name}" (${confirm.patient.patientCode}) will be soft-deleted and disappear from the list. Records are preserved.`
      : confirm.patient.status === "active"
        ? `Mark patient "${confirm.patient.name}" as inactive? They will remain searchable and can be reactivated any time.`
        : `Activate patient "${confirm.patient.name}"? They will be available for new appointments and admissions.`;

  return (
    <div className="space-y-4">
      <PatientSearchPicker
        title="Patient Profile Management"
        description="Search a patient to review and update their complete profile."
        selectedId={selected?.id ?? null}
        onPick={pick}
        refreshToken={profileToken}
      />

      {/* Selected patient profile */}
      {selected && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
              Profile
            </span>
            <button
              onClick={() => setSelected(null)}
              className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors cursor-pointer"
            >
              Choose another patient
            </button>
          </div>

          <PatientProfileModal
            key={`${selected.id}-${profileToken}`}
            variant="page"
            patient={selected}
            caps={caps}
            refreshToken={profileToken}
            onClose={() => setSelected(null)}
            onRefreshNeeded={() => {
              onChanged();
              setProfileToken((t) => t + 1);
            }}
            onRequestStatus={(p) => setConfirm({ kind: "status", patient: p })}
            onRequestDelete={(p) => setConfirm({ kind: "delete", patient: p })}
            notify={notify}
            onEdit={() => setEditing(selected)}
          />
        </div>
      )}

      {editing && (
        <PatientFormModal
          key={editing.id}
          mode="edit"
          patient={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            notify("success", `Patient ${editing.patientCode} updated.`);
            setEditing(null);
            onChanged();
            setProfileToken((t) => t + 1);
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirmLabel}
        message={confirmMessage}
        danger={confirm?.kind === "delete"}
        confirmLabel={
          confirm?.kind === "delete"
            ? "Delete Patient"
            : confirm?.patient.status === "active"
              ? "Deactivate"
              : "Activate"
        }
        loading={confirming}
        onConfirm={runConfirm}
        onClose={() => !confirming && setConfirm(null)}
      />
    </div>
  );
}
