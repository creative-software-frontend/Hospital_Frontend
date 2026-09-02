// app/patients/PatientModule.tsx
// Live Patient Management module (feature id = 1 in the dashboard).
// Lists patients from GET /api/patients with server-side pagination,
// search and filters, and drives the create/edit/profile/status/delete flows.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiEye, FiEdit2, FiTrash2, FiPlus, FiRefreshCcw, FiSearch, FiUser, FiTag, FiPhone,
} from "react-icons/fi";
import {
  patientApi,
  type PaginationMeta,
  type PatientListRecord,
  type PatientStatus,
  errorMessage,
  calcAge,
  formatDate,
} from "@/app/lib/api";
import type { UserRole } from "@/app/config/roleConfig";
import { patientCapabilities } from "@/app/lib/roles";
import { genderLabel, bloodGroupLabel } from "@/app/patients/constants";
import { PatientFormModal } from "@/app/patients/PatientFormModal";
import { PatientProfileModal } from "@/app/patients/PatientProfileModal";
import { ConfirmDialog } from "@/app/patients/ConfirmDialog";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const PAGE_SIZE = 20;
const SELECT_CLS =
  "bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

interface ConfirmState {
  kind: "delete" | "status";
  patient: PatientListRecord;
}

export function PatientModule({ role }: { role: UserRole | null }) {
  const caps = patientCapabilities(role);

  const [rows, setRows] = useState<PatientListRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientListRecord | null>(null);
  const [viewingPatient, setViewingPatient] = useState<PatientListRecord | null>(null);
  const [profileRefreshToken, setProfileRefreshToken] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Debounce the free-text search.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    try {
      const result = await patientApi.list({
        page,
        limit: PAGE_SIZE,
        search: searchTerm || undefined,
        gender: (genderFilter as "MALE" | "FEMALE" | "OTHER") || undefined,
        status: statusFilter ? (statusFilter as PatientStatus) : undefined,
      });
      setRows(result.data);
      setPagination(result.pagination);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, genderFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const refreshList = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const openCreate = () => {
    setEditingPatient(null);
    setFormOpen(true);
  };

  const openEdit = (patient: PatientListRecord) => {
    setEditingPatient(patient);
    setFormOpen(true);
  };

  const totalPages = pagination?.totalPages ?? 1;
  const safePage = Math.min(page, Math.max(1, totalPages));

  const confirmLabel = useMemo(() => {
    if (!confirm) return "";
    if (confirm.kind === "delete") return "Delete Patient";
    return confirm.patient.status === "active" ? "Deactivate Patient" : "Activate Patient";
  }, [confirm]);

  const confirmMessage = useMemo(() => {
    if (!confirm) return "";
    const name = `${confirm.patient.firstName} ${confirm.patient.lastName ?? ""}`.trim();
    if (confirm.kind === "delete") {
      return `Patient "${name}" (${confirm.patient.patientCode}) will be soft-deleted and disappear from the list. Records are preserved.`;
    }
    return confirm.patient.status === "active"
      ? `Mark patient "${name}" as inactive? They will remain searchable and can be reactivated any time.`
      : `Activate patient "${name}"? They will be available for new appointments and admissions.`;
  }, [confirm]);

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try {
      if (confirm.kind === "delete") {
        await patientApi.remove(confirm.patient.id);
        notify("success", `Patient ${confirm.patient.patientCode} deleted.`);
        setViewingPatient(null);
        if (rows.length === 1 && page > 1) {
          setPage((p) => p - 1);
        }
      } else {
        const next: PatientStatus = confirm.patient.status === "active" ? "inactive" : "active";
        await patientApi.updateStatus(confirm.patient.id, next);
        notify("success", `Patient ${confirm.patient.patientCode} marked ${next}.`);
        setProfileRefreshToken((t) => t + 1);
      }
      setConfirm(null);
      setConfirming(false);
      refreshList();
    } catch (err) {
      notify("error", errorMessage(err));
      setConfirm(null);
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + toolbar */}
      <div className="card p-6 rounded-2xl shadow-sm space-y-4 w-full">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
              Patient Management
            </span>
            <h3 className="font-black text-xl text-[var(--primary-dark)]">Patients</h3>
          </div>

          {caps.create && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-[var(--primary)]/20 active:scale-[0.98] cursor-pointer"
            >
              <FiPlus className="w-3.5 h-3.5" />
              Register Patient
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="w-full max-w-sm relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, code, phone, email..."
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              className={SELECT_CLS}
              value={genderFilter}
              onChange={(e) => {
                setGenderFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Genders</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              className={SELECT_CLS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              onClick={() => {
                setSearchInput("");
                setSearchTerm("");
                setGenderFilter("");
                setStatusFilter("");
                setPage(1);
                refreshList();
              }}
              title="Reset filters"
              className="p-2.5 rounded-xl border bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] transition-colors inline-flex items-center justify-center cursor-pointer"
            >
              <FiRefreshCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] w-full">
          <table className="min-w-[900px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Patient</th>
                <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Patient Code</th>
                <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Gender</th>
                <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Age</th>
                <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Blood</th>
                <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Contact</th>
                {role === "super-admin" && (
                  <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Branch</th>
                )}
                <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Status</th>
                <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Last Updated</th>
                <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={role === "super-admin" ? 10 : 9} className="px-4 py-12 text-center">
                    <div className="inline-flex items-center gap-3 text-xs font-bold text-[var(--muted)]">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--primary)]"></div>
                      Loading patients...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={role === "super-admin" ? 10 : 9} className="px-4 py-12 text-center">
                    <div className="inline-flex flex-col items-center gap-2 text-xs font-bold text-[var(--muted)]">
                      <FiUser className="w-6 h-6 text-[var(--muted)]/50" />
                      No patients match the current filters.
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setViewingPatient(p)}
                    className="hover:bg-[var(--primary-soft)]/10 transition-colors cursor-pointer"
                  >
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      <span className="font-bold">{p.firstName} {p.lastName ?? ""}</span>
                      {p.dateOfBirth && (
                        <span className="block text-[10px] text-[var(--muted)]">{formatDate(p.dateOfBirth)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--primary-dark)] bg-[var(--primary-soft)]/25 rounded-lg px-2 py-1">
                        <FiTag className="w-3 h-3" /> {p.patientCode}
                      </span>
                    </td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{genderLabel(p.gender)}</td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{calcAge(p.dateOfBirth)}</td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{bloodGroupLabel(p.bloodGroup)}</td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      <span className="flex items-center gap-1.5">{p.phone ?? "—"}</span>
                      <span className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                        <FiPhone className="w-2.5 h-2.5" /> {p.email ?? "no email"}
                      </span>
                    </td>
                    {role === "super-admin" && (
                      <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                        {p.branch?.name ?? p.branchId}
                      </td>
                    )}
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <StatusChip status={p.status} />
                    </td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                      {formatDate(p.updatedAt)}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-1">
                        <ActionBtn title="View profile" onClick={(e) => { e.stopPropagation(); setViewingPatient(p); }}>
                          <FiEye className="w-3.5 h-3.5" />
                        </ActionBtn>
                        {caps.edit && (
                          <ActionBtn title="Edit patient" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                            <FiEdit2 className="w-3.5 h-3.5" />
                          </ActionBtn>
                        )}
                        {caps.edit && (
                          <ActionBtn
                            title={p.status === "active" ? "Deactivate" : "Activate"}
                            onClick={(e) => { e.stopPropagation(); setConfirm({ kind: "status", patient: p }); }}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full ${p.status === "active" ? "bg-amber-400" : "bg-emerald-500"}`} />
                          </ActionBtn>
                        )}
                        {caps.delete && (
                          <ActionBtn danger title="Delete patient" onClick={(e) => { e.stopPropagation(); setConfirm({ kind: "delete", patient: p }); }}>
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </ActionBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && pagination && (
          <div className="flex items-center justify-between gap-3 pt-3">
            <div className="text-xs text-[var(--muted)]">
              Showing {rows.length} of {pagination.total} patients
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  safePage <= 1
                    ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed"
                    : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"
                }`}
              >
                Previous
              </button>
              <span className="text-xs font-bold text-[var(--muted)]">
                Page {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  safePage >= totalPages
                    ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed"
                    : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs font-semibold text-rose-600 flex items-center justify-between">
            {error}
            <button onClick={refreshList} className="text-xs font-bold text-rose-700 underline cursor-pointer">Retry</button>
          </div>
        )}
      </div>

      {/* Modals */}
      {formOpen && (
        <PatientFormModal
          key={editingPatient?.id ?? "create"}
          mode={editingPatient ? "edit" : "create"}
          patient={editingPatient}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            if (editingPatient) {
              notify("success", `Patient ${editingPatient.patientCode} updated.`);
            } else {
              notify("success", "Patient created successfully.");
              setPage(1);
            }
            refreshList();
          }}
        />
      )}

      {viewingPatient && (
        <PatientProfileModal
          patient={viewingPatient}
          caps={caps}
          refreshToken={profileRefreshToken}
          onClose={() => setViewingPatient(null)}
          onRefreshNeeded={refreshList}
          onRequestStatus={(p) => setConfirm({ kind: "status", patient: p })}
          onRequestDelete={(p) => setConfirm({ kind: "delete", patient: p })}
          notify={notify}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirmLabel}
        message={confirmMessage}
        danger={confirm?.kind === "delete"}
        confirmLabel={confirm?.kind === "delete" ? "Delete Patient" : confirm?.patient.status === "active" ? "Deactivate" : "Activate"}
        loading={confirming}
        onConfirm={runConfirm}
        onClose={() => !confirming && setConfirm(null)}
      />

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function StatusChip({ status }: { status: PatientStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 ${
        status === "active"
          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
          : "bg-rose-50 text-rose-500 border border-rose-200"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-rose-400"}`} />
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

function ActionBtn({
  title,
  onClick,
  danger = false,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors cursor-pointer ${
        danger
          ? "text-[var(--muted)] hover:bg-rose-50 hover:text-rose-500"
          : "text-[var(--muted)] hover:bg-[var(--primary-soft)]/20 hover:text-[var(--primary-dark)]"
      }`}
    >
      {children}
    </button>
  );
}